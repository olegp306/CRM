import { describe, expect, it } from "vitest";
import { createDocxPackageBytes } from "@app/documents";
import {
  createAssistantGeneratedDocumentPrismaStore,
  KpTemplateUnavailableError,
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

function createFakeClientWithCurrentTemplate() {
  const fake = createFakeClient();
  const client: AssistantGeneratedDocumentPrismaClientLike = {
    ...fake.client,
    attachment: {
      ...fake.client.attachment!,
      findFirst: (args) => {
        fake.calls.push({ method: "attachment.findFirst", args });
        return Promise.resolve({
          id: "template-attachment-1",
          workspaceId: "workspace-1",
          storageKey: "workspaces/workspace-1/templates/kp/KP_Template_LP1-4.docx",
          fileName: "KP_Template_LP1-4.docx",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        });
      }
    },
    documentTemplate: {
      findFirst: (args) => {
        fake.calls.push({ method: "documentTemplate.findFirst", args });
        return Promise.resolve({
          id: "template-kp-current",
          name: "KP_Template_LP1-4",
          currentVersionId: "template-kp-current-v1",
          versions: [{ id: "template-kp-current-v1", attachmentId: "template-attachment-1", version: 1 }]
        });
      }
    }
  };

  return { client, calls: fake.calls };
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

  it("requires an uploaded current KP template before generating documents", async () => {
    const { client } = createFakeClient();
    const store = createAssistantGeneratedDocumentPrismaStore(client);

    await expect(
      store.create({
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
      })
    ).rejects.toBeInstanceOf(KpTemplateUnavailableError);
  });

  it("creates durable generated documents from the current uploaded template", async () => {
    const { client, calls } = createFakeClientWithCurrentTemplate();
    const templateBytes = createDocxPackageBytes({
      title: "Custom KP for {{ client_name }}",
      paragraphs: ["Project: {{ project_address }}"]
    });
    const store = createAssistantGeneratedDocumentPrismaStore(client, {
      objectStorage: {
        putObject: async () => undefined,
        getObject: async () => templateBytes,
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

    expect(calls[2]).toEqual({
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
    expect(calls[3]).toEqual({
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
    expect(calls[4]).toEqual({
      method: "create",
      args: {
        data: {
          workspaceId: "workspace-1",
          documentType: "kp",
          templateId: "template-kp-current",
          templateVersionId: "template-kp-current-v1",
          sourceType: "assistant",
          sourceId: "L-2026-001",
          docxAttachmentId: "attachment-docx-1",
          pdfAttachmentId: "attachment-pdf-1",
          status: "generated",
          inputSnapshot: {
            documentId: "D-20260521-message-4",
            rawInput: "Generate KP for lead L-2026-001",
            sourceRecordIds: ["L-2026-001"],
            renderedContent: "Custom KP for Katya\nProject: Chiemseeufer 7",
            templateName: "KP_Template_LP1-4",
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

  it("writes generated document artifacts rendered from the uploaded template to object storage", async () => {
    const { client } = createFakeClientWithCurrentTemplate();
    const uploads: Array<{ key: string; body: Uint8Array; contentType: string }> = [];
    const templateBytes = createDocxPackageBytes({
      title: "Custom KP for {{ client_name }}",
      paragraphs: ["Project: {{ project_address }}", "BGF: {{ bgf }}"]
    });
    const store = createAssistantGeneratedDocumentPrismaStore(client, {
      objectStorage: {
        putObject: async (input) => {
          uploads.push(input);
        },
        getObject: async () => templateBytes,
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
    expect(docxText).toContain("Custom KP for Katya");
    expect(docxText).toContain("Project: Chiemseeufer 7");
    expect(docxText).toContain("BGF: 180");
    const pdfText = new TextDecoder().decode(uploads[1].body);
    expect(pdfText).toContain("/MediaBox [0 0 595 842]");
    expect(pdfText).toContain("Custom KP for Katya");
    expect(pdfText).toContain("Project: Chiemseeufer 7");
    expect(new TextDecoder().decode(uploads[1].body)).not.toContain("DRAFT:");
  });

  it("marks generated KP artifacts as drafts when required data is missing", async () => {
    const { client } = createFakeClientWithCurrentTemplate();
    const uploads: Array<{ key: string; body: Uint8Array; contentType: string }> = [];
    const templateBytes = createDocxPackageBytes({
      title: "Custom KP for {{ client_name }}",
      paragraphs: ["Project: {{ project_address }}", "BGF: {{ bgf }}"]
    });
    const store = createAssistantGeneratedDocumentPrismaStore(client, {
      objectStorage: {
        putObject: async (input) => {
          uploads.push(input);
        },
        getObject: async () => templateBytes,
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

  it("uses the latest uploaded KP template when one is available", async () => {
    const { client, calls } = createFakeClientWithCurrentTemplate();
    const uploads: Array<{ key: string; body: Uint8Array; contentType: string }> = [];
    const templateBytes = createDocxPackageBytes({
      title: "Custom KP for {{ client_name }}",
      paragraphs: ["Project: {{ project_address }}", "BGF: {{ bgf }}", "Valid until {{ offer_valid_until }}"]
    });
    const store = createAssistantGeneratedDocumentPrismaStore(client, {
      objectStorage: {
        putObject: async (input) => {
          uploads.push(input);
        },
        getObject: async (key) => {
          expect(key).toBe("workspaces/workspace-1/templates/kp/KP_Template_LP1-4.docx");
          return templateBytes;
        },
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

    const docxText = new TextDecoder().decode(uploads[0].body);
    expect(calls[0]).toEqual({
      method: "documentTemplate.findFirst",
      args: {
        where: { workspaceId: "workspace-1", documentType: "kp", isActive: true },
        orderBy: { createdAt: "desc" },
        include: {
          versions: {
            orderBy: { version: "desc" },
            take: 1
          }
        }
      }
    });
    expect(calls[1]).toEqual({
      method: "attachment.findFirst",
      args: {
        where: {
          id: "template-attachment-1",
          workspaceId: "workspace-1"
        }
      }
    });
    expect(docxText).toContain("Custom KP for Katya");
    expect(docxText).toContain("Project: Chiemseeufer 7");
    expect(docxText).toContain("BGF: 180");
    expect(calls.find((call) => call.method === "create")).toEqual({
      method: "create",
      args: expect.objectContaining({
        data: expect.objectContaining({
          templateId: "template-kp-current",
          templateVersionId: "template-kp-current-v1",
          inputSnapshot: expect.objectContaining({
            templateName: "KP_Template_LP1-4"
          })
        })
      })
    });
  });
});
