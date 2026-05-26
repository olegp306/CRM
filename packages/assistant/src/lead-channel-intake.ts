import { createLeadIntakeDraft, type LeadIntakeDraft } from "@app/core";
import type { AssistantChannelAttachment, AssistantChannelMessage } from "./channel-message";

export type ParsedAssistantLeadInput = {
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

export type AssistantLeadParserClient = {
  parseLead(input: {
    text: string;
    receivedAt: string;
    attachments?: AssistantChannelAttachment[];
  }): Promise<ParsedAssistantLeadInput>;
};

export type AssistantLeadIntakeDraft = Omit<LeadIntakeDraft, "missingData"> & {
  missingData: string[];
  temperature: ParsedAssistantLeadInput["temperature"];
  channelSourceExternalIds: string[];
};

export async function createLeadDraftFromAssistantChannelMessage(
  message: AssistantChannelMessage,
  parser: AssistantLeadParserClient
): Promise<AssistantLeadIntakeDraft> {
  const parsed = await parser.parseLead({
    text: message.content,
    receivedAt: message.receivedAt,
    attachments: message.attachments
  });
  const sourceExternalIds = [`${message.channel}:${message.threadId}:${message.messageId}`];
  const rawInput = [
    message.content,
    `${message.channel} sources: ${sourceExternalIds.join(", ")}`,
    createChannelAttachmentSummary(message.attachments),
    `Summary: ${parsed.summary}`,
    `Suggested reply: ${parsed.suggestedReply}`
  ]
    .filter(Boolean)
    .join("\n");

  const draft = createLeadIntakeDraft({
    source: message.channel,
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
    temperature: parsed.temperature,
    channelSourceExternalIds: sourceExternalIds
  };
}

function createChannelAttachmentSummary(attachments: AssistantChannelAttachment[]): string {
  return attachments
    .map((attachment, index) => `Attachment ${index + 1}: ${attachment.kind} (${attachment.fileName})`)
    .join("\n");
}
