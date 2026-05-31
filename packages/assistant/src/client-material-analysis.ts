import type { AssistantChannel, AssistantChannelAttachment } from "./channel-message";

export type ClientMaterialDocumentSummary = {
  fileName: string;
  kind: AssistantChannelAttachment["kind"] | "audio";
  summary: string;
  transcript?: string | null;
  storageKey?: string | null;
  sourceUrl?: string | null;
};

export type ClientMaterialAnalysisInput = {
  channel: AssistantChannel;
  receivedAt: string;
  text: string;
  authorName?: string;
  authorUsername?: string;
  attachments?: AssistantChannelAttachment[];
};

export type ClientMaterialAnalysisResult = {
  clientName: string;
  requestType: string;
  urgency: "low" | "medium" | "high" | "urgent";
  temperature: "cold" | "warm" | "hot" | "unknown";
  bgfM2?: number;
  projectAddress?: string;
  email: string | null;
  phone: string | null;
  budgetEur?: number | null;
  desiredStart?: string | null;
  desiredMoveIn?: string | null;
  isStandard?: boolean | null;
  missingData: string[];
  leadSummary: string;
  documentSummaries: ClientMaterialDocumentSummary[];
  suggestedReply: string;
  confidence: number;
};

export type ClientMaterialAnalyzer = {
  analyze(input: ClientMaterialAnalysisInput): Promise<ClientMaterialAnalysisResult>;
};

type NullableClientMaterialAnalysisResult = Omit<
  ClientMaterialAnalysisResult,
  "bgfM2" | "projectAddress" | "documentSummaries"
> & {
  bgfM2: number | null;
  projectAddress: string | null;
  documentSummaries: Array<{
    fileName: string;
    kind: AssistantChannelAttachment["kind"] | "audio";
    summary: string;
    transcript?: string | null;
    storageKey?: string | null;
    sourceUrl?: string | null;
  }>;
};

export function normalizeClientMaterialAnalysisResult(
  result: NullableClientMaterialAnalysisResult
): ClientMaterialAnalysisResult {
  return {
    ...result,
    bgfM2: result.bgfM2 ?? undefined,
    projectAddress: result.projectAddress ?? undefined,
    documentSummaries: result.documentSummaries.map((summary) => ({
      fileName: summary.fileName,
      kind: summary.kind,
      summary: summary.summary,
      transcript: summary.transcript ?? null,
      storageKey: summary.storageKey ?? null,
      sourceUrl: summary.sourceUrl ?? null
    }))
  };
}

export function createClientMaterialAnalysisJsonSchema() {
  return {
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
      "budgetEur",
      "desiredStart",
      "desiredMoveIn",
      "isStandard",
      "missingData",
      "leadSummary",
      "documentSummaries",
      "suggestedReply",
      "confidence"
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
      budgetEur: { type: ["number", "null"] },
      desiredStart: { type: ["string", "null"] },
      desiredMoveIn: { type: ["string", "null"] },
      isStandard: { type: ["boolean", "null"] },
      missingData: { type: "array", items: { type: "string" } },
      leadSummary: { type: "string" },
      documentSummaries: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["fileName", "kind", "summary", "transcript", "storageKey", "sourceUrl"],
          properties: {
            fileName: { type: "string" },
            kind: { type: "string", enum: ["photo", "pdf", "docx", "text", "other", "audio"] },
            summary: { type: "string" },
            transcript: { type: ["string", "null"] },
            storageKey: { type: ["string", "null"] },
            sourceUrl: { type: ["string", "null"] }
          }
        }
      },
      suggestedReply: { type: "string" },
      confidence: { type: "number" }
    }
  } as const;
}
