import { createLeadIntakeDraft, type LeadIntakeDraft } from "@app/core";
import type { AssistantChannelAttachment, AssistantChannelMessage } from "./channel-message";
import type { ClientMaterialDocumentSummary } from "./client-material-analysis";

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
  leadSummary?: string;
  documentSummaries?: ClientMaterialDocumentSummary[];
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
    parsed.leadSummary ? `Lead summary: ${parsed.leadSummary}` : "",
    createDocumentSummaryBlock(parsed.documentSummaries),
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

function createDocumentSummaryBlock(summaries: ClientMaterialDocumentSummary[] | undefined): string {
  if (!summaries || summaries.length === 0) {
    return "";
  }

  return [
    "Source material summaries:",
    ...summaries.map((summary) => {
      const transcript = summary.transcript ? ` Transcript: ${summary.transcript}` : "";
      return `- ${summary.fileName}: ${summary.summary}${transcript}`;
    })
  ].join("\n");
}
