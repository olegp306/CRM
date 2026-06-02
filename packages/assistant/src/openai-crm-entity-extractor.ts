import { normalizeCrmEntityExtraction, type CrmEntityExtraction } from "./crm-entity-extractor";

type ResponsesApiContentBlock = {
  type?: unknown;
  text?: unknown;
};

export type CrmEntityExtractorInput = {
  channel: "telegram" | "web";
  workspaceId: string;
  messageId: string;
  leadId?: string | null;
  text: string;
  receivedAt: string;
  attachments: Array<{ kind: string; fileName: string; summary?: string | null }>;
};

export type CrmEntityExtractorClient = {
  extract(input: CrmEntityExtractorInput): Promise<CrmEntityExtraction>;
};

export function createOpenAiCrmEntityExtractor(config: {
  apiKey: string;
  model: string;
  prompt: string;
  fetchImpl?: typeof fetch;
}): CrmEntityExtractorClient {
  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    async extract(input) {
      const response = await fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: config.model,
          input: [
            {
              role: "system",
              content: [
                config.prompt,
                "Return only JSON matching the provided schema.",
                "Do not mutate CRM data. Extract only explicit or strongly implied CRM entities."
              ].join("\n")
            },
            {
              role: "user",
              content: JSON.stringify(input)
            }
          ],
          text: {
            format: {
              type: "json_schema",
              name: "crm_entity_extraction",
              schema: createCrmEntityExtractionJsonSchema()
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI CRM entity extractor request failed: ${response.status} ${response.statusText}`);
      }

      const outputText = extractResponseOutputText(await response.json());
      if (!outputText) {
        throw new Error("OpenAI CRM entity extractor response did not include output_text");
      }

      return normalizeCrmEntityExtraction(JSON.parse(outputText));
    }
  };
}

function createCrmEntityExtractionJsonSchema() {
  const confidenceEnum = ["high", "medium", "low"];
  const recurrenceEnum = ["none", "daily", "weekly", "monthly", "yearly", null];
  const baseEntity = {
    type: "object",
    additionalProperties: false,
    required: ["type", "label", "value", "sourceText", "confidence", "leadFieldHint"],
    properties: {
      type: { type: "string", enum: ["FACT", "EVENT", "FOLLOW_UP", "PERSON", "ORGANIZATION", "TAG"] },
      label: { type: "string" },
      value: { type: "string" },
      sourceText: { type: "string" },
      confidence: { type: "string", enum: confidenceEnum },
      leadFieldHint: { type: ["string", "null"] }
    }
  };

  const followupEntity = {
    type: "object",
    additionalProperties: false,
    required: ["type", "label", "value", "title", "dueAt", "recurrence", "assigneeHint", "sourceText", "confidence", "leadFieldHint"],
    properties: {
      type: { type: "string", enum: ["FOLLOW_UP"] },
      label: { type: "string" },
      value: { type: "string" },
      title: { type: "string" },
      dueAt: { type: ["string", "null"] },
      recurrence: { enum: recurrenceEnum },
      assigneeHint: { type: ["string", "null"] },
      sourceText: { type: "string" },
      confidence: { type: "string", enum: confidenceEnum },
      leadFieldHint: { type: ["string", "null"] }
    }
  };

  const eventEntity = {
    type: "object",
    additionalProperties: false,
    required: ["type", "label", "value", "startsAt", "recurrence", "sourceText", "confidence", "leadFieldHint"],
    properties: {
      type: { type: "string", enum: ["EVENT"] },
      label: { type: "string" },
      value: { type: "string" },
      startsAt: { type: ["string", "null"] },
      recurrence: { enum: recurrenceEnum },
      sourceText: { type: "string" },
      confidence: { type: "string", enum: confidenceEnum },
      leadFieldHint: { type: ["string", "null"] }
    }
  };

  const tagEntity = {
    type: "object",
    additionalProperties: false,
    required: ["type", "label", "value", "normalizedKey", "sourceText", "confidence", "leadFieldHint"],
    properties: {
      type: { type: "string", enum: ["TAG"] },
      label: { type: "string" },
      value: { type: "string" },
      normalizedKey: { type: "string" },
      sourceText: { type: "string" },
      confidence: { type: "string", enum: confidenceEnum },
      leadFieldHint: { type: ["string", "null"] }
    }
  };

  return {
    type: "object",
    additionalProperties: false,
    required: ["facts", "events", "followups", "people", "organizations", "tags", "leadNaming", "confidence", "summary"],
    properties: {
      facts: { type: "array", items: baseEntity },
      events: { type: "array", items: eventEntity },
      followups: { type: "array", items: followupEntity },
      people: { type: "array", items: baseEntity },
      organizations: { type: "array", items: baseEntity },
      tags: { type: "array", items: tagEntity },
      leadNaming: {
        type: "object",
        additionalProperties: false,
        required: ["displayName", "projectPlace", "language", "country"],
        properties: {
          displayName: { type: ["string", "null"] },
          projectPlace: { type: ["string", "null"] },
          language: { type: ["string", "null"] },
          country: { type: ["string", "null"] }
        }
      },
      confidence: {
        type: "object",
        additionalProperties: false,
        required: ["overall"],
        properties: {
          overall: { type: "string", enum: confidenceEnum }
        }
      },
      summary: { type: "string" }
    }
  };
}

function extractResponseOutputText(body: unknown): string | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  if ("output_text" in body && typeof body.output_text === "string") {
    return body.output_text;
  }

  if (!("output" in body) || !Array.isArray(body.output)) {
    return undefined;
  }

  for (const item of body.output) {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) {
      continue;
    }

    const outputText = (item.content as ResponsesApiContentBlock[]).find((content) => content?.type === "output_text");
    if (outputText && typeof outputText.text === "string") {
      return outputText.text;
    }
  }

  return undefined;
}
