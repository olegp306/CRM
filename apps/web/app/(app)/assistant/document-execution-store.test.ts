import { describe, expect, it } from "vitest";
import { createMemoryGeneratedDocumentStore, selectGeneratedDocumentStoreRuntime } from "./document-execution-store";

describe("selectGeneratedDocumentStoreRuntime", () => {
  it("keeps the memory document store in tests when no database URL is configured", () => {
    expect(
      selectGeneratedDocumentStoreRuntime({
        databaseUrl: undefined,
        nodeEnv: "test",
        memoryStore: "memory",
        prismaStore: "prisma"
      })
    ).toBe("memory");
  });

  it("requires a database URL outside tests", () => {
    expect(() =>
      selectGeneratedDocumentStoreRuntime({
        databaseUrl: undefined,
        nodeEnv: "production",
        memoryStore: "memory",
        prismaStore: "prisma"
      })
    ).toThrow("DATABASE_URL is required for generated document store in production.");
  });

  it("uses the Prisma document store when a database URL is configured", () => {
    expect(
      selectGeneratedDocumentStoreRuntime({
        databaseUrl: "postgresql://example",
        nodeEnv: "production",
        memoryStore: "memory",
        prismaStore: "prisma"
      })
    ).toBe("prisma");
  });

  it("creates generated document attachment ids in memory store", async () => {
    const store = createMemoryGeneratedDocumentStore([]);

    await expect(
      store.create({
        workspaceId: "workspace-1",
        documentId: "D-20260521-message-4",
        documentType: "kp",
        sourceRecordIds: ["L-2026-001"],
        rawInput: "Generate KP",
        requestedByUserId: "user-1"
      })
    ).resolves.toMatchObject({
      docxAttachmentId: "memory-generated-docx-1",
      pdfAttachmentId: "memory-generated-pdf-1"
    });
  });
});
