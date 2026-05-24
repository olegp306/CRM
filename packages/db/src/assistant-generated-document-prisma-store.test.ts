import { describe, expect, it } from "vitest";
import {
  createAssistantGeneratedDocumentPrismaStore,
  type AssistantGeneratedDocumentPrismaClientLike
} from "./assistant-generated-document-prisma-store";

type Call = {
  method: string;
  args: unknown;
};

function createFakeClient() {
  const calls: Call[] = [];
  const rows = [
    {
      id: "generated-document-record-1",
      workspaceId: "workspace-1",
      documentType: "kp",
      templateId: "assistant-kp-template",
      templateVersionId: "assistant-kp-template-v1",
      sourceType: "assistant",
      sourceId: "L-2026-001",
      docxAttachmentId: "attachment-docx-1",
      pdfAttachmentId: "attachment-pdf-1",
      status: "generated",
      inputSnapshot: {
        documentId: "D-20260521-message-4",
        rawInput: "Generate KP for lead L-2026-001",
        sourceRecordIds: ["L-2026-001"],
        renderedContent: "Commercial proposal for L-2026-001",
        fieldSnapshot: {
          clientName: "Katya",
          requestType: "new_build",
          projectAddress: "Chiemseeufer 7",
          bgfM2: 180,
          email: "katya@example.com",
          phone: "+49 170 000",
          missingData: []
        }
      },
      generatedByUserId: "user-1"
    }
  ];
  const client: AssistantGeneratedDocumentPrismaClientLike = {
    attachment: {
      create: (args) => {
        calls.push({ method: "attachment.create", args });
        const data = (args as { data: { storageKey: string } }).data;
        return Promise.resolve({ id: data.storageKey.endsWith(".pdf") ? "attachment-pdf-1" : "attachment-docx-1" });
      }
    },
    generatedDocument: {
      findMany: (args) => {
        calls.push({ method: "findMany", args });
        return Promise.resolve(rows);
      },
      create: (args) => {
        calls.push({ method: "create", args });
        return Promise.resolve(rows[0]);
      }
    }
  };

  return { client, calls };
}

describe("assistant generated document Prisma store", () => {
  it("lists assistant-generated KP documents for a workspace", async () => {
    const { client, calls } = createFakeClient();
    const store = createAssistantGeneratedDocumentPrismaStore(client);

    const documents = await store.list("workspace-1");

    expect(documents).toEqual([
      {
        id: "generated-document-record-1",
        workspaceId: "workspace-1",
        documentId: "D-20260521-message-4",
        documentType: "kp",
        docxAttachmentId: "attachment-docx-1",
        pdfAttachmentId: "attachment-pdf-1",
        sourceRecordIds: ["L-2026-001"],
        rawInput: "Generate KP for lead L-2026-001",
        fieldSnapshot: {
          clientName: "Katya",
          requestType: "new_build",
          projectAddress: "Chiemseeufer 7",
          bgfM2: 180,
          email: "katya@example.com",
          phone: "+49 170 000",
          missingData: []
        },
        requestedByUserId: "user-1"
      }
    ]);
    expect(calls[0]).toEqual({
      method: "findMany",
      args: {
        where: { workspaceId: "workspace-1", documentType: "kp", sourceType: "assistant" },
        orderBy: { generatedAt: "desc" }
      }
    });
  });

  it("creates durable generated documents from assistant execution input", async () => {
    const { client, calls } = createFakeClient();
    const store = createAssistantGeneratedDocumentPrismaStore(client);

    await store.create({
      workspaceId: "workspace-1",
      documentId: "D-20260521-message-4",
      documentType: "kp",
      sourceRecordIds: ["L-2026-001"],
      rawInput: "Generate KP for lead L-2026-001",
      fieldSnapshot: {
        clientName: "Katya",
        requestType: "new_build",
        projectAddress: "Chiemseeufer 7",
        bgfM2: 180,
        email: "katya@example.com",
        phone: "+49 170 000",
        missingData: []
      },
      requestedByUserId: "user-1"
    });

    expect(calls[0]).toEqual({
      method: "attachment.create",
      args: {
        data: {
          workspaceId: "workspace-1",
          storageKey: "workspaces/workspace-1/generated/kp/d-20260521-message-4.docx",
          fileName: "D-20260521-message-4.docx",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          sizeBytes: expect.any(Number),
          status: "current",
          source: "generated_document",
          createdByUserId: "user-1"
        }
      }
    });
    expect(calls[1]).toEqual({
      method: "attachment.create",
      args: {
        data: {
          workspaceId: "workspace-1",
          storageKey: "workspaces/workspace-1/generated/kp/d-20260521-message-4.pdf",
          fileName: "D-20260521-message-4.pdf",
          mimeType: "application/pdf",
          sizeBytes: expect.any(Number),
          status: "current",
          source: "generated_document",
          createdByUserId: "user-1"
        }
      }
    });
    expect(calls[2]).toEqual({
      method: "create",
      args: {
        data: {
          workspaceId: "workspace-1",
          documentType: "kp",
          templateId: "assistant-kp-template",
          templateVersionId: "assistant-kp-template-v1",
          sourceType: "assistant",
          sourceId: "L-2026-001",
          docxAttachmentId: "attachment-docx-1",
          pdfAttachmentId: "attachment-pdf-1",
          status: "generated",
          inputSnapshot: {
            documentId: "D-20260521-message-4",
            rawInput: "Generate KP for lead L-2026-001",
            sourceRecordIds: ["L-2026-001"],
            renderedContent: "Commercial proposal for L-2026-001",
            fieldSnapshot: {
              clientName: "Katya",
              requestType: "new_build",
              projectAddress: "Chiemseeufer 7",
              bgfM2: 180,
              email: "katya@example.com",
              phone: "+49 170 000",
              missingData: []
            }
          },
          generatedByUserId: "user-1"
        }
      }
    });
  });

  it("writes generated document artifacts to object storage when configured", async () => {
    const { client } = createFakeClient();
    const uploads: Array<{ key: string; body: Uint8Array; contentType: string }> = [];
    const store = createAssistantGeneratedDocumentPrismaStore(client, {
      objectStorage: {
        putObject: async (input) => {
          uploads.push(input);
        },
        getObject: async () => new Uint8Array(),
        deleteObject: async () => undefined
      }
    });

    await store.create({
      workspaceId: "workspace-1",
      documentId: "D-20260521-message-4",
      documentType: "kp",
      sourceRecordIds: ["L-2026-001"],
      rawInput: "Generate KP for lead L-2026-001",
      fieldSnapshot: {
        clientName: "Katya",
        requestType: "new_build",
        projectAddress: "Chiemseeufer 7",
        bgfM2: 180,
        email: "katya@example.com",
        phone: "+49 170 000",
        missingData: []
      },
      requestedByUserId: "user-1"
    });

    expect(uploads).toEqual([
      expect.objectContaining({
        key: "workspaces/workspace-1/generated/kp/d-20260521-message-4.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      }),
      expect.objectContaining({
        key: "workspaces/workspace-1/generated/kp/d-20260521-message-4.pdf",
        contentType: "application/pdf"
      })
    ]);
    expect(new TextDecoder().decode(uploads[1].body)).toContain("%PDF-1.4");
    expect(uploads[0].body[0]).toBe(0x50);
    expect(uploads[0].body[1]).toBe(0x4b);
    const docxText = new TextDecoder().decode(uploads[0].body);
    expect(docxText).toContain("word/document.xml");
    expect(docxText).toContain("Client: Katya");
    expect(docxText).toContain("Project address: Chiemseeufer 7");
    expect(docxText).toContain("BGF m2: 180");
    expect(new TextDecoder().decode(uploads[1].body)).not.toContain("DRAFT:");
  });

  it("marks generated KP artifacts as drafts when required data is missing", async () => {
    const { client } = createFakeClient();
    const uploads: Array<{ key: string; body: Uint8Array; contentType: string }> = [];
    const store = createAssistantGeneratedDocumentPrismaStore(client, {
      objectStorage: {
        putObject: async (input) => {
          uploads.push(input);
        },
        getObject: async () => new Uint8Array(),
        deleteObject: async () => undefined
      }
    });

    await store.create({
      workspaceId: "workspace-1",
      documentId: "D-20260521-message-5",
      documentType: "kp",
      sourceRecordIds: ["L-2026-002"],
      rawInput: "Generate draft KP for lead L-2026-002",
      fieldSnapshot: {
        clientName: "Katya",
        requestType: "new_build",
        projectAddress: null,
        bgfM2: null,
        email: null,
        phone: null,
        missingData: ["projectAddress", "bgfM2"]
      },
      requestedByUserId: "user-1"
    });

    const pdfText = new TextDecoder().decode(uploads[1].body);
    const docxText = new TextDecoder().decode(uploads[0].body);
    expect(pdfText).toContain("DRAFT: This commercial proposal is missing required data: projectAddress, bgfM2.");
    expect(docxText).toContain("Processed lead brief");
    expect(docxText).toContain("Generate draft KP for lead L-2026-002");
    expect(docxText).toContain("Prepared proposal text");
    expect(docxText).toContain("DRAFT: This commercial proposal is missing required data: projectAddress, bgfM2.");
    expect(docxText).not.toContain("Project address: null");
  });
});
