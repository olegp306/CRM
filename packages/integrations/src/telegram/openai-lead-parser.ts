import { createLeadIntakeDraft, type LeadIntakeDraft } from "@app/core";

export type TelegramLeadMessage = {
  messageId: number;
  sourceMessageIds?: number[];
  chatId: string;
  text: string;
  receivedAt: string;
  authorName?: string;
  authorUsername?: string;
  attachments?: TelegramLeadAttachment[];
};

export type TelegramLeadAttachment = {
  kind: "photo" | "pdf" | "audio";
  mimeType: string;
  base64: string;
  fileName?: string;
  transcript?: string;
};

export type ParsedTelegramLeadInput = {
  clientName: string;
  requestType: string;
  urgency: "low" | "medium" | "high" | "urgent";
  temperature: "cold" | "warm" | "hot" | "unknown";
  bgfM2?: number;
  projectAddress?: string;
  email?: string | null;
  phone?: string | null;
  missingData: string[];
  summary: string;
  suggestedReply: string;
};

type OpenAiParsedTelegramLeadInput = Omit<ParsedTelegramLeadInput, "bgfM2" | "projectAddress"> & {
  bgfM2: number | null;
  projectAddress: string | null;
};

type ResponsesApiContentBlock = {
  type?: unknown;
  text?: unknown;
};

type OpenAiUserContentBlock =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "high" }
  | { type: "input_file"; filename: string; file_data: string };

export type OpenAiLeadParserClient = {
  parseLead(input: { text: string; receivedAt: string; attachments?: TelegramLeadAttachment[] }): Promise<ParsedTelegramLeadInput>;
};

export type TelegramLeadIntakeDraft = Omit<LeadIntakeDraft, "missingData"> & {
  missingData: string[];
  telegramSourceExternalId: string;
  temperature: ParsedTelegramLeadInput["temperature"];
};

export function createTelegramSourceExternalId(chatId: string, messageId: number): string {
  return `telegram:${chatId}:${messageId}`;
}

export function createTelegramSourceExternalIds(message: Pick<TelegramLeadMessage, "chatId" | "messageId" | "sourceMessageIds">): string[] {
  return (message.sourceMessageIds ?? [message.messageId]).map((messageId) => createTelegramSourceExternalId(message.chatId, messageId));
}

// Telegram keeps this adapter while web lead intake migrates to the shared channel intake.
// The output shape must remain compatible with existing Telegram worker tests.
export async function createLeadDraftFromTelegramMessage(
  message: TelegramLeadMessage,
  parser: OpenAiLeadParserClient
): Promise<TelegramLeadIntakeDraft> {
  const parsed = await parser.parseLead({ text: message.text, receivedAt: message.receivedAt, attachments: message.attachments });
  const telegramSourceExternalIds = createTelegramSourceExternalIds(message);
  const telegramSourceExternalId = telegramSourceExternalIds[0] ?? createTelegramSourceExternalId(message.chatId, message.messageId);
  const rawInput = [
    message.text,
    `Telegram sources: ${telegramSourceExternalIds.join(", ")}`,
    createTelegramAttachmentSummary(message.attachments),
    `Summary: ${parsed.summary}`,
    `Suggested reply: ${parsed.suggestedReply}`
  ].filter(Boolean).join("\n");

  const draft = createLeadIntakeDraft({
      source: "telegram",
      clientName: parsed.clientName,
      email: parsed.email,
      phone: parsed.phone,
      requestType: parsed.requestType,
      projectAddress: parsed.projectAddress,
      bgfM2: parsed.bgfM2,
      rawInput
    });

  return {
    ...draft,
    missingData: Array.from(new Set([...draft.missingData, ...parsed.missingData])),
    telegramSourceExternalId,
    temperature: parsed.temperature
  };
}

function createTelegramAttachmentSummary(attachments: TelegramLeadAttachment[] | undefined): string {
  if (!attachments || attachments.length === 0) {
    return "";
  }

  return attachments
    .map((attachment, index) => {
      const number = index + 1;
      if (attachment.kind === "photo") {
        return `Telegram attachment ${number}: photo (${attachment.mimeType})`;
      }

      if (attachment.kind === "audio") {
        return [
          `Telegram attachment ${number}: audio (${attachment.fileName ?? "telegram-audio"})`,
          attachment.transcript ? `Audio transcript ${number}: ${attachment.transcript}` : ""
        ]
          .filter(Boolean)
          .join("\n");
      }

      return `Telegram attachment ${number}: PDF (${attachment.fileName ?? "telegram-lead.pdf"})`;
    })
    .join("\n");
}

export function createOpenAiLeadParserClient(config: { apiKey: string; model: string; fetchImpl?: typeof fetch }): OpenAiLeadParserClient {
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
                "Extract an architecture CRM lead from Telegram. Return only JSON with clientName, requestType, urgency, temperature, bgfM2, projectAddress, email, phone, missingData, summary, suggestedReply. Keep actions review-first."
            },
            {
              role: "user",
              content: createOpenAiUserContent(input)
            }
          ],
          text: {
            format: {
              type: "json_schema",
              name: "telegram_architecture_lead",
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
        throw new Error(`OpenAI request failed: ${response.status} ${response.statusText}`);
      }

      const outputText = extractResponseOutputText(await response.json());
      if (!outputText) {
        throw new Error("OpenAI response did not include output_text");
      }

      const parsed = JSON.parse(outputText) as OpenAiParsedTelegramLeadInput;

      return {
        ...parsed,
        bgfM2: parsed.bgfM2 ?? undefined,
        projectAddress: parsed.projectAddress ?? undefined
      };
    }
  };
}

function createOpenAiUserContent(input: { text: string; receivedAt: string; attachments?: TelegramLeadAttachment[] }) {
  const text = `Received at ${input.receivedAt}\n\n${input.text}`;
  const attachments = input.attachments ?? [];

  if (attachments.length === 0) {
    return text;
  }

  const content: OpenAiUserContentBlock[] = [
    { type: "input_text", text },
    ...attachments.flatMap<OpenAiUserContentBlock>((attachment) => {
      if (attachment.kind === "photo") {
        return [{
          type: "input_image",
          image_url: `data:${attachment.mimeType};base64,${attachment.base64}`,
          detail: "high"
        }];
      }

      if (attachment.kind === "audio") {
        return [];
      }

      return [{
        type: "input_file",
        filename: attachment.fileName ?? "telegram-lead.pdf",
        file_data: attachment.base64
      }];
    })
  ];

  return content;
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
