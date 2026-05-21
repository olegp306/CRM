import { createTemplateAttachmentMetadata } from "@app/core";
import { validateDocumentTemplate, type DocumentTemplateValidationStatus } from "@app/documents";

type DocumentTemplateVersionRow = {
  id: string;
  templateId: string;
  version: number;
  attachmentId: string;
  detectedPlaceholders: unknown;
  unknownPlaceholders: unknown;
  validationStatus: string;
  uploadedByUserId: string | null;
  uploadedAt: Date;
  changeNote: string | null;
};

type DocumentTemplateRow = {
  id: string;
  workspaceId: string;
  name: string;
  documentType: string;
  language: string;
  isActive: boolean;
  currentVersionId: string | null;
  createdAt: Date;
  versions?: DocumentTemplateVersionRow[];
};

export type DocumentTemplatePrismaClientLike = {
  attachment?: {
    create(args: unknown): Promise<{ id: string }>;
  };
  documentTemplate: {
    findMany(args: unknown): Promise<DocumentTemplateRow[]>;
    create(args: unknown): Promise<DocumentTemplateRow>;
    update(args: unknown): Promise<DocumentTemplateRow>;
  };
  documentTemplateVersion: {
    create(args: unknown): Promise<DocumentTemplateVersionRow>;
  };
};

export type DocumentTemplateRecord = {
  id: string;
  attachmentId: string | null;
  name: string;
  documentType: string;
  language: string;
  isActive: boolean;
  currentVersionId: string | null;
  version: number | null;
  detectedPlaceholders: string[];
  unknownPlaceholders: string[];
  validationStatus: DocumentTemplateValidationStatus | "missing_version";
  updatedAt: Date;
};

export type CreateDocumentTemplateInput = {
  workspaceId: string;
  name: string;
  documentType: string;
  language: string;
  attachmentId: string;
  templateText: string;
  uploadedByUserId?: string;
  changeNote?: string;
};

export type CreateDocumentTemplateFromUploadInput = Omit<CreateDocumentTemplateInput, "attachmentId"> & {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type DocumentTemplateStore = {
  list(workspaceId: string): Promise<DocumentTemplateRecord[]>;
  create(input: CreateDocumentTemplateInput): Promise<DocumentTemplateRecord>;
  createFromUpload(input: CreateDocumentTemplateFromUploadInput): Promise<DocumentTemplateRecord>;
};

export function createDocumentTemplatePrismaStore(client: DocumentTemplatePrismaClientLike): DocumentTemplateStore {
  return {
    async list(workspaceId) {
      const rows = await client.documentTemplate.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        include: {
          versions: {
            orderBy: { version: "desc" },
            take: 1
          }
        }
      });

      return rows.map(toDocumentTemplateRecord);
    },

    async create(input) {
      const validation = validateDocumentTemplate(input.templateText);
      const template = await client.documentTemplate.create({
        data: {
          workspaceId: input.workspaceId,
          name: input.name,
          documentType: input.documentType,
          language: input.language,
          isActive: true
        }
      });

      const version = await client.documentTemplateVersion.create({
        data: {
          templateId: template.id,
          version: 1,
          attachmentId: input.attachmentId,
          detectedPlaceholders: validation.detectedPlaceholders,
          unknownPlaceholders: validation.unknownPlaceholders,
          validationStatus: validation.validationStatus,
          uploadedByUserId: input.uploadedByUserId,
          changeNote: input.changeNote
        }
      });

      const updatedTemplate = await client.documentTemplate.update({
        where: { id: template.id },
        data: { currentVersionId: version.id }
      });

      return toDocumentTemplateRecord({ ...updatedTemplate, versions: [version] });
    },

    async createFromUpload(input) {
      if (!client.attachment) {
        throw new Error("Attachment storage is not available for document template uploads.");
      }

      const attachmentMetadata = createTemplateAttachmentMetadata({
        workspaceId: input.workspaceId,
        documentType: input.documentType,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        createdByUserId: input.uploadedByUserId
      });
      const attachment = await client.attachment.create({ data: attachmentMetadata });

      return this.create({
        workspaceId: input.workspaceId,
        name: input.name,
        documentType: input.documentType,
        language: input.language,
        attachmentId: attachment.id,
        templateText: input.templateText,
        uploadedByUserId: input.uploadedByUserId,
        changeNote: input.changeNote
      });
    }
  };
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toDocumentTemplateRecord(row: DocumentTemplateRow): DocumentTemplateRecord {
  const currentVersion = row.versions?.[0];

  return {
    id: row.id,
    attachmentId: currentVersion?.attachmentId ?? null,
    name: row.name,
    documentType: row.documentType,
    language: row.language,
    isActive: row.isActive,
    currentVersionId: row.currentVersionId,
    version: currentVersion?.version ?? null,
    detectedPlaceholders: toStringArray(currentVersion?.detectedPlaceholders),
    unknownPlaceholders: toStringArray(currentVersion?.unknownPlaceholders),
    validationStatus: (currentVersion?.validationStatus as DocumentTemplateValidationStatus | undefined) ?? "missing_version",
    updatedAt: currentVersion?.uploadedAt ?? row.createdAt
  };
}
