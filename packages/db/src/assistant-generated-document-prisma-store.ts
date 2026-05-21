import type { GeneratedKpDocumentRecord, GenerateKpDocumentFromAssistantInput } from "@app/assistant";
import { createGeneratedDocumentAttachmentMetadata } from "@app/core";
import { renderDocumentTemplate } from "@app/documents";

const ASSISTANT_KP_TEMPLATE_ID = "assistant-kp-template";
const ASSISTANT_KP_TEMPLATE_VERSION_ID = "assistant-kp-template-v1";
const ASSISTANT_KP_TEMPLATE = "KP draft for {{source_id}}";

type GeneratedDocumentRow = {
  id: string;
  workspaceId: string;
  documentType: string;
  sourceType: string;
  sourceId: string;
  docxAttachmentId?: string | null;
  pdfAttachmentId?: string | null;
  inputSnapshot: unknown;
  generatedByUserId?: string | null;
};

export type AssistantGeneratedDocumentPrismaClientLike = {
  attachment?: {
    create(args: unknown): Promise<{ id: string }>;
  };
  generatedDocument: {
    findMany(args: unknown): Promise<GeneratedDocumentRow[]>;
    create(args: unknown): Promise<GeneratedDocumentRow>;
  };
};

export type AssistantGeneratedDocumentStore = {
  list(workspaceId: string): Promise<GeneratedKpDocumentRecord[]>;
  create(input: GenerateKpDocumentFromAssistantInput): Promise<GeneratedKpDocumentRecord>;
};

export function createAssistantGeneratedDocumentPrismaStore(
  client: AssistantGeneratedDocumentPrismaClientLike
): AssistantGeneratedDocumentStore {
  return {
    async list(workspaceId) {
      const rows = await client.generatedDocument.findMany({
        where: { workspaceId, documentType: "kp", sourceType: "assistant" },
        orderBy: { generatedAt: "desc" }
      });

      return rows.map(toGeneratedKpDocumentRecord);
    },

    async create(input) {
      if (!client.attachment) {
        throw new Error("Attachment storage is not available for generated documents.");
      }

      const docxAttachment = await client.attachment.create({
        data: createGeneratedDocumentAttachmentMetadata({
          workspaceId: input.workspaceId,
          documentId: input.documentId,
          documentType: input.documentType,
          format: "docx",
          createdByUserId: input.requestedByUserId
        })
      });
      const pdfAttachment = await client.attachment.create({
        data: createGeneratedDocumentAttachmentMetadata({
          workspaceId: input.workspaceId,
          documentId: input.documentId,
          documentType: input.documentType,
          format: "pdf",
          createdByUserId: input.requestedByUserId
        })
      });
      const rendered = renderDocumentTemplate(ASSISTANT_KP_TEMPLATE, {
        source_id: input.sourceRecordIds[0] ?? "assistant request"
      });
      const row = await client.generatedDocument.create({
        data: {
          workspaceId: input.workspaceId,
          documentType: input.documentType,
          templateId: ASSISTANT_KP_TEMPLATE_ID,
          templateVersionId: ASSISTANT_KP_TEMPLATE_VERSION_ID,
          sourceType: "assistant",
          sourceId: input.sourceRecordIds[0] ?? input.documentId,
          docxAttachmentId: docxAttachment.id,
          pdfAttachmentId: pdfAttachment.id,
          status: "generated",
          inputSnapshot: {
            documentId: input.documentId,
            rawInput: input.rawInput,
            sourceRecordIds: input.sourceRecordIds,
            renderedContent: rendered.content
          },
          generatedByUserId: input.requestedByUserId
        }
      });

      return toGeneratedKpDocumentRecord(row);
    }
  };
}

function toGeneratedKpDocumentRecord(row: GeneratedDocumentRow): GeneratedKpDocumentRecord {
  const snapshot = toSnapshot(row.inputSnapshot);

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    documentId: snapshot.documentId,
    documentType: "kp",
    docxAttachmentId: row.docxAttachmentId ?? undefined,
    pdfAttachmentId: row.pdfAttachmentId ?? undefined,
    sourceRecordIds: snapshot.sourceRecordIds,
    rawInput: snapshot.rawInput,
    requestedByUserId: row.generatedByUserId ?? ""
  };
}

function toSnapshot(value: unknown): {
  documentId: string;
  rawInput: string;
  sourceRecordIds: string[];
} {
  if (!value || typeof value !== "object") {
    return { documentId: "", rawInput: "", sourceRecordIds: [] };
  }

  const snapshot = value as Record<string, unknown>;
  return {
    documentId: typeof snapshot.documentId === "string" ? snapshot.documentId : "",
    rawInput: typeof snapshot.rawInput === "string" ? snapshot.rawInput : "",
    sourceRecordIds: Array.isArray(snapshot.sourceRecordIds)
      ? snapshot.sourceRecordIds.filter((item): item is string => typeof item === "string")
      : []
  };
}
