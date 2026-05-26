import type { AssistantChannelAttachment } from "./channel-message";
import type { AssistantLeadParserClient, ParsedAssistantLeadInput } from "./lead-channel-intake";

type OpenAiParsedAssistantLeadInput = Omit<ParsedAssistantLeadInput, "bgfM2" | "projectAddress"> & {
  bgfM2: number | null;
  projectAddress: string | null;
};

type ResponsesApiContentBlock = {
  type?: unknown;
  text?: unknown;
};

export function createOpenAiAssistantLeadParserClient(config: {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}): AssistantLeadParserClient {
  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    async parseLead(input) {
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
              content:
                "Extract an architecture CRM lead from assistant source material. Return only JSON with clientName, requestType, urgency, temperature, bgfM2, projectAddress, email, phone, missingData, summary, suggestedReply. Keep actions review-first."
            },
            {
              role: "user",
              content: createOpenAiUserContent(input)
            }
          ],
          text: {
            format: {
              type: "json_schema",
              name: "assistant_architecture_lead",
              schema: {
                type: "object",
                additionalProperties: false,
                required: [
                  "clientName",
                  "requestType",
                  "urgency",
                  "temperature",
                  "bgfM2",
                  "projectAddress",
                  "email",
                  "phone",
                  "missingData",
                  "summary",
                  "suggestedReply"
                ],
                properties: {
                  clientName: { type: "string" },
                  requestType: { type: "string" },
                  urgency: { type: "string", enum: ["low", "medium", "high", "urgent"] },
                  temperature: { type: "string", enum: ["cold", "warm", "hot", "unknown"] },
                  bgfM2: { type: ["number", "null"] },
                  projectAddress: { type: ["string", "null"] },
                  email: { type: ["string", "null"] },
                  phone: { type: ["string", "null"] },
                  missingData: { type: "array", items: { type: "string" } },
                  summary: { type: "string" },
                  suggestedReply: { type: "string" }
                }
              }
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI lead parser request failed: ${response.status} ${response.statusText}`);
      }

      const outputText = extractResponseOutputText(await response.json());
      if (!outputText) {
        throw new Error("OpenAI lead parser response did not include output_text");
      }

      const parsed = JSON.parse(outputText) as OpenAiParsedAssistantLeadInput;

      return {
        ...parsed,
        bgfM2: parsed.bgfM2 ?? undefined,
        projectAddress: parsed.projectAddress ?? undefined
      };
    }
  };
}

function createOpenAiUserContent(input: {
  text: string;
  receivedAt: string;
  attachments?: AssistantChannelAttachment[];
}): string | Array<Record<string, unknown>> {
  const text = `Received at ${input.receivedAt}\n\n${input.text}`;
  const attachments = input.attachments ?? [];

  if (attachments.length === 0) {
    return text;
  }

  return [
    { type: "input_text", text },
    ...attachments.flatMap((attachment) => createOpenAiAttachmentContent(attachment))
  ];
}

function createOpenAiAttachmentContent(attachment: AssistantChannelAttachment): Array<Record<string, unknown>> {
  if (!attachment.base64) {
    return [];
  }

  if (attachment.kind === "photo") {
    return [
      {
        type: "input_image",
        image_url: `data:${attachment.mimeType};base64,${attachment.base64}`,
        detail: "high"
      }
    ];
  }

  if (attachment.kind === "pdf" || attachment.kind === "docx") {
    return [
      {
        type: "input_file",
        filename: attachment.fileName,
        file_data: attachment.base64
      }
    ];
  }

  if (attachment.kind === "text") {
    return [{ type: "input_text", text: decodeBase64Text(attachment.base64) ?? `Text attachment: ${attachment.fileName}` }];
  }

  return [];
}

function decodeBase64Text(base64: string): string | null {
  try {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(base64, "base64").toString("utf8");
    }

    return atob(base64);
  } catch {
    return null;
  }
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
