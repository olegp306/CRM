import { DOCX_MIME_TYPE } from "./template-attachment";

export type GeneratedDocumentAttachmentFormat = "docx" | "pdf";

export type GeneratedDocumentAttachmentMetadataInput = {
  workspaceId: string;
  documentId: string;
  documentType: string;
  format: GeneratedDocumentAttachmentFormat;
  createdByUserId?: string;
};

export type GeneratedDocumentAttachmentMetadata = {
  workspaceId: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: "current";
  source: "generated_document";
  createdByUserId?: string;
};

export function createGeneratedDocumentAttachmentMetadata(
  input: GeneratedDocumentAttachmentMetadataInput
): GeneratedDocumentAttachmentMetadata {
  const fileName = `${input.documentId}.${input.format}`;

  return {
    workspaceId: input.workspaceId,
    storageKey: `workspaces/${input.workspaceId}/generated/${toStorageSegment(input.documentType)}/${toStorageSegment(fileName)}`,
    fileName,
    mimeType: input.format === "docx" ? DOCX_MIME_TYPE : "application/pdf",
    sizeBytes: 0,
    status: "current",
    source: "generated_document",
    createdByUserId: input.createdByUserId
  };
}

function toStorageSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
