import type { GeneratedKpDocumentRecord, GenerateKpDocumentFromAssistantInput } from "@app/assistant";
import { createGeneratedDocumentAttachmentMetadata } from "@app/core";
import type { ObjectStorage } from "@app/core/storage";
import { createDocxPackageBytes, renderDocumentTemplate } from "@app/documents";

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
  client: AssistantGeneratedDocumentPrismaClientLike,
  options: { objectStorage?: ObjectStorage } = {}
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

      const rendered = renderDocumentTemplate(ASSISTANT_KP_TEMPLATE, {
        source_id: input.sourceRecordIds[0] ?? "assistant request"
      });
      const paragraphs = createKpDocumentParagraphs(input, rendered.content);
      const docxBody = createDocxPackageBytes({
        title: `KP document ${input.documentId}`,
        paragraphs
      });
      const pdfBody = createMinimalPdfBytes(input.documentId, paragraphs);
      const docxMetadata = createGeneratedDocumentAttachmentMetadata({
        workspaceId: input.workspaceId,
        documentId: input.documentId,
        documentType: input.documentType,
        format: "docx",
        createdByUserId: input.requestedByUserId
      });
      const pdfMetadata = createGeneratedDocumentAttachmentMetadata({
        workspaceId: input.workspaceId,
        documentId: input.documentId,
        documentType: input.documentType,
        format: "pdf",
        createdByUserId: input.requestedByUserId
      });

      if (options.objectStorage) {
        await options.objectStorage.putObject({
          key: docxMetadata.storageKey,
          body: docxBody,
          contentType: docxMetadata.mimeType
        });
        await options.objectStorage.putObject({
          key: pdfMetadata.storageKey,
          body: pdfBody,
          contentType: pdfMetadata.mimeType
        });
      }

      const docxAttachment = await client.attachment.create({
        data: { ...docxMetadata, sizeBytes: docxBody.byteLength }
      });
      const pdfAttachment = await client.attachment.create({
        data: { ...pdfMetadata, sizeBytes: pdfBody.byteLength }
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
            renderedContent: rendered.content,
            fieldSnapshot: input.fieldSnapshot
          },
          generatedByUserId: input.requestedByUserId
        }
      });

      return toGeneratedKpDocumentRecord(row);
    }
  };
}

function createKpDocumentParagraphs(input: GenerateKpDocumentFromAssistantInput, renderedContent: string): string[] {
  const fields = input.fieldSnapshot;
  const fieldParagraphs = [
    ["Client", fields?.clientName],
    ["Request type", fields?.requestType],
    ["Project address", fields?.projectAddress],
    ["BGF m2", fields?.bgfM2 === null || fields?.bgfM2 === undefined ? "" : String(fields.bgfM2)],
    ["Email", fields?.email],
    ["Phone", fields?.phone],
    ["Missing data", fields?.missingData && fields.missingData.length > 0 ? fields.missingData.join(", ") : ""]
  ]
    .filter(([, value]) => String(value ?? "").trim().length > 0)
    .map(([label, value]) => `${label}: ${value}`);

  return [
    renderedContent,
    ...fieldParagraphs,
    `Source records: ${input.sourceRecordIds.length > 0 ? input.sourceRecordIds.join(", ") : "assistant request"}`,
    `Source material: ${input.rawInput}`
  ];
}

function createMinimalPdfBytes(documentId: string, paragraphs: string[]): Uint8Array {
  const lines = [`KP document ${documentId}`, ...paragraphs].map(escapePdfText);
  const lineOps = lines
    .map((line, index) => `${index === 0 ? "/F1 14 Tf" : "/F1 10 Tf"} (${line}) Tj 0 -22 Td`)
    .join(" ");
  const stream = `BT 50 780 Td ${lineOps} ET`;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];

  for (const object of objects) {
    offsets.push(body.length);
    body += `${object}\n`;
  }

  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(body);
}

function escapePdfText(value: string): string {
  return value.replace(/[\\()]/g, "\\$&").replace(/\r?\n/g, " ").slice(0, 220);
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
    fieldSnapshot: snapshot.fieldSnapshot,
    requestedByUserId: row.generatedByUserId ?? ""
  };
}

function toSnapshot(value: unknown): {
  documentId: string;
  rawInput: string;
  sourceRecordIds: string[];
  fieldSnapshot?: GenerateKpDocumentFromAssistantInput["fieldSnapshot"];
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
      : [],
    fieldSnapshot: toKpFieldSnapshot(snapshot.fieldSnapshot)
  };
}

function toKpFieldSnapshot(value: unknown): GenerateKpDocumentFromAssistantInput["fieldSnapshot"] | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const snapshot = value as Record<string, unknown>;
  return {
    clientName: toOptionalString(snapshot.clientName),
    requestType: toOptionalString(snapshot.requestType),
    projectAddress: toOptionalString(snapshot.projectAddress),
    bgfM2: typeof snapshot.bgfM2 === "number" ? snapshot.bgfM2 : null,
    email: toOptionalString(snapshot.email),
    phone: toOptionalString(snapshot.phone),
    missingData: Array.isArray(snapshot.missingData)
      ? snapshot.missingData.filter((item): item is string => typeof item === "string")
      : []
  };
}

function toOptionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
