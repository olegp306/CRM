export const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type TemplateAttachmentMetadataInput = {
  workspaceId: string;
  documentType: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdByUserId?: string;
};

export type TemplateAttachmentMetadata = {
  workspaceId: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: "draft";
  source: "template_upload";
  createdByUserId?: string;
};

export function createTemplateAttachmentMetadata(input: TemplateAttachmentMetadataInput): TemplateAttachmentMetadata {
  if (input.mimeType !== DOCX_MIME_TYPE || !input.fileName.toLowerCase().endsWith(".docx")) {
    throw new Error("Template uploads must be DOCX files.");
  }

  return {
    workspaceId: input.workspaceId,
    storageKey: `workspaces/${input.workspaceId}/templates/${toStorageSegment(input.documentType)}/${toStorageSegment(
      input.fileName
    )}`,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    status: "draft",
    source: "template_upload",
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
