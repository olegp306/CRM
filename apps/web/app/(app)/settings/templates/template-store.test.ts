import { describe, expect, it } from "vitest";
import { createMemoryDocumentTemplateStore, selectDocumentTemplateStoreRuntime } from "./template-store";

describe("selectDocumentTemplateStoreRuntime", () => {
  it("uses memory store in tests when database url is absent", () => {
    const memoryStore = { kind: "memory" };
    const prismaStore = { kind: "prisma" };

    expect(selectDocumentTemplateStoreRuntime({ databaseUrl: "", nodeEnv: "test", memoryStore, prismaStore })).toBe(
      memoryStore
    );
  });

  it("requires a database URL outside tests", () => {
    const memoryStore = { kind: "memory" };
    const prismaStore = { kind: "prisma" };

    expect(() =>
      selectDocumentTemplateStoreRuntime({ databaseUrl: "", nodeEnv: "development", memoryStore, prismaStore })
    ).toThrow("DATABASE_URL is required for document template store in development.");
  });

  it("uses prisma store when database url is present", () => {
    const memoryStore = { kind: "memory" };
    const prismaStore = { kind: "prisma" };

    expect(
      selectDocumentTemplateStoreRuntime({
        databaseUrl: "postgres://localhost/db",
        nodeEnv: "development",
        memoryStore,
        prismaStore
      })
    ).toBe(prismaStore);
  });

  it("creates a memory template from upload metadata", async () => {
    const store = createMemoryDocumentTemplateStore([]);

    await expect(
      store.createFromUpload({
        workspaceId: "workspace-1",
        name: "KP Template",
        documentType: "kp",
        language: "en",
        fileName: "KP Template.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: 2048,
        templateText: "{{ client_name }} {{ custom_fee }}",
        uploadedByUserId: "user-1"
      })
    ).resolves.toMatchObject({
      name: "KP Template",
      documentType: "kp",
      attachmentId: "memory-attachment-1",
      unknownPlaceholders: ["custom_fee"],
      validationStatus: "needs_attention"
    });
  });
});
