import {
  createDocumentTemplatePrismaStore,
  prisma,
  type CreateDocumentTemplateInput,
  type CreateDocumentTemplateFromUploadInput,
  type DocumentTemplateRecord,
  type DocumentTemplateStore
} from "@app/db";
import { createTemplateAttachmentMetadata } from "@app/core";
import { validateDocumentTemplate } from "@app/documents";
import { selectDatabaseBackedRuntime } from "../../../../lib/database-runtime";

type GlobalTemplateStore = typeof globalThis & {
  documentTemplates?: DocumentTemplateRecord[];
  documentTemplatePrismaStore?: DocumentTemplateStore;
};

const globalForTemplates = globalThis as GlobalTemplateStore;

function getMemoryTemplates(): DocumentTemplateRecord[] {
  if (!globalForTemplates.documentTemplates) {
    const validation = validateDocumentTemplate("Dear {{ client_name }}, project {{ project_address }}.");
    globalForTemplates.documentTemplates = [
      {
        id: "demo-template-kp",
        attachmentId: "demo-template-kp-attachment",
        name: "Demo KP template",
        documentType: "kp",
        language: "en",
        isActive: true,
        currentVersionId: "demo-template-kp-v1",
        version: 1,
        detectedPlaceholders: validation.detectedPlaceholders,
        unknownPlaceholders: validation.unknownPlaceholders,
        validationStatus: validation.validationStatus,
        updatedAt: new Date("2026-05-21T00:00:00.000Z")
      }
    ];
  }

  return globalForTemplates.documentTemplates;
}

export function selectDocumentTemplateStoreRuntime<TStore>({
  databaseUrl,
  nodeEnv,
  memoryStore,
  prismaStore
}: {
  databaseUrl?: string;
  nodeEnv?: string;
  memoryStore: TStore;
  prismaStore: TStore;
}): TStore {
  return selectDatabaseBackedRuntime({
    databaseUrl,
    nodeEnv,
    memoryRuntime: memoryStore,
    databaseRuntime: prismaStore,
    runtimeName: "document template store"
  });
}

export function createMemoryDocumentTemplateStore(templates = getMemoryTemplates()): DocumentTemplateStore {
  return {
    async list() {
      return templates;
    },
    async create(input: CreateDocumentTemplateInput) {
      const validation = validateDocumentTemplate(input.templateText);
      const record: DocumentTemplateRecord = {
        id: `template-${templates.length + 1}`,
        attachmentId: input.attachmentId,
        name: input.name,
        documentType: input.documentType,
        language: input.language,
        isActive: true,
        currentVersionId: `template-${templates.length + 1}-v1`,
        version: 1,
        detectedPlaceholders: validation.detectedPlaceholders,
        unknownPlaceholders: validation.unknownPlaceholders,
        validationStatus: validation.validationStatus,
        updatedAt: new Date()
      };
      templates.unshift(record);
      return record;
    },
    async createFromUpload(input: CreateDocumentTemplateFromUploadInput) {
      createTemplateAttachmentMetadata({
        workspaceId: input.workspaceId,
        documentType: input.documentType,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        createdByUserId: input.uploadedByUserId
      });

      return this.create({
        workspaceId: input.workspaceId,
        name: input.name,
        documentType: input.documentType,
        language: input.language,
        attachmentId: `memory-attachment-${templates.length + 1}`,
        templateText: input.templateText,
        uploadedByUserId: input.uploadedByUserId,
        changeNote: input.changeNote
      });
    }
  };
}

function getDocumentTemplateStore(): DocumentTemplateStore {
  const memoryStore = createMemoryDocumentTemplateStore();

  if (!globalForTemplates.documentTemplatePrismaStore) {
    globalForTemplates.documentTemplatePrismaStore = createDocumentTemplatePrismaStore(prisma);
  }

  return selectDocumentTemplateStoreRuntime({
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    memoryStore,
    prismaStore: globalForTemplates.documentTemplatePrismaStore
  });
}

export async function listDocumentTemplates(workspaceId: string): Promise<DocumentTemplateRecord[]> {
  return getDocumentTemplateStore().list(workspaceId);
}

export async function createDocumentTemplateFromUpload(input: CreateDocumentTemplateFromUploadInput): Promise<DocumentTemplateRecord> {
  return getDocumentTemplateStore().createFromUpload(input);
}
