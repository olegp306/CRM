import type { GenerateKpDocumentFromAssistantInput, GeneratedKpDocumentRecord } from "@app/assistant";
import { createAssistantGeneratedDocumentPrismaStore, prisma, type AssistantGeneratedDocumentStore } from "@app/db";
import { selectDatabaseBackedRuntime } from "../../../lib/database-runtime";

const globalForAssistantDocuments = globalThis as typeof globalThis & {
  assistantGeneratedDocuments?: GeneratedKpDocumentRecord[];
  assistantGeneratedDocumentPrismaStore?: AssistantGeneratedDocumentStore;
};

function getStore() {
  if (!globalForAssistantDocuments.assistantGeneratedDocuments) {
    globalForAssistantDocuments.assistantGeneratedDocuments = [];
  }

  return globalForAssistantDocuments.assistantGeneratedDocuments;
}

export function createMemoryGeneratedDocumentStore(documents = getStore()): AssistantGeneratedDocumentStore {
  return {
    async list(workspaceId) {
      return documents.filter((document) => document.workspaceId === workspaceId);
    },
    async create(input) {
      const nextIndex = documents.length + 1;
      const document: GeneratedKpDocumentRecord = {
        id: `generated-document-record-${Date.now()}`,
        ...input,
        docxAttachmentId: `memory-generated-docx-${nextIndex}`,
        pdfAttachmentId: `memory-generated-pdf-${nextIndex}`
      };

      documents.push(document);
      return document;
    }
  };
}

export function selectGeneratedDocumentStoreRuntime<TStore>({
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
    runtimeName: "generated document store"
  });
}

function getAssistantGeneratedDocumentStore(): AssistantGeneratedDocumentStore {
  const memoryStore = createMemoryGeneratedDocumentStore();

  if (!globalForAssistantDocuments.assistantGeneratedDocumentPrismaStore) {
    globalForAssistantDocuments.assistantGeneratedDocumentPrismaStore = createAssistantGeneratedDocumentPrismaStore(prisma);
  }

  return selectGeneratedDocumentStoreRuntime({
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    memoryStore,
    prismaStore: globalForAssistantDocuments.assistantGeneratedDocumentPrismaStore
  });
}

export async function listAssistantGeneratedDocuments(workspaceId: string): Promise<GeneratedKpDocumentRecord[]> {
  return getAssistantGeneratedDocumentStore().list(workspaceId);
}

export async function generateAssistantKpDocument(
  input: GenerateKpDocumentFromAssistantInput
): Promise<GeneratedKpDocumentRecord> {
  return getAssistantGeneratedDocumentStore().create(input);
}
