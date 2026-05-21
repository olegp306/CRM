import { describe, expect, it } from "vitest";
import { createDocumentTemplatePrismaStore, type DocumentTemplatePrismaClientLike } from "./document-template-prisma-store";

const createdAt = new Date("2026-05-21T10:00:00.000Z");
const uploadedAt = new Date("2026-05-21T10:01:00.000Z");

function createClient(): { client: DocumentTemplatePrismaClientLike; calls: unknown[] } {
  const calls: unknown[] = [];
  const versionRow = {
    id: "version-1",
    templateId: "template-1",
    version: 1,
    attachmentId: "attachment-1",
    detectedPlaceholders: ["client_name", "custom_fee"],
    unknownPlaceholders: ["custom_fee"],
    validationStatus: "needs_attention",
    uploadedByUserId: "user-1",
    uploadedAt,
    changeNote: "Initial KP template"
  };
  const templateRow = {
    id: "template-1",
    workspaceId: "workspace-1",
    name: "KP Template",
    documentType: "kp",
    language: "en",
    isActive: true,
    currentVersionId: "version-1",
    createdAt,
    versions: [versionRow]
  };
  const attachmentRow = {
    id: "attachment-1",
    workspaceId: "workspace-1",
    storageKey: "workspaces/workspace-1/templates/kp/kp-template.docx",
    fileName: "KP Template.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: 2048,
    status: "draft",
    source: "template_upload",
    createdByUserId: "user-1",
    createdAt
  };

  return {
    calls,
    client: {
      attachment: {
        create: async (args) => {
          calls.push({ method: "attachment.create", args });
          return attachmentRow;
        }
      },
      documentTemplate: {
        findMany: async (args) => {
          calls.push({ method: "documentTemplate.findMany", args });
          return [templateRow];
        },
        create: async (args) => {
          calls.push({ method: "documentTemplate.create", args });
          return { ...templateRow, currentVersionId: null, versions: [] };
        },
        update: async (args) => {
          calls.push({ method: "documentTemplate.update", args });
          return templateRow;
        }
      },
      documentTemplateVersion: {
        create: async (args) => {
          calls.push({ method: "documentTemplateVersion.create", args });
          return versionRow;
        }
      }
    }
  };
}

describe("createDocumentTemplatePrismaStore", () => {
  it("lists templates with current validation summary", async () => {
    const { client } = createClient();
    const store = createDocumentTemplatePrismaStore(client);

    await expect(store.list("workspace-1")).resolves.toEqual([
      {
        id: "template-1",
        attachmentId: "attachment-1",
        name: "KP Template",
        documentType: "kp",
        language: "en",
        isActive: true,
        currentVersionId: "version-1",
        version: 1,
        detectedPlaceholders: ["client_name", "custom_fee"],
        unknownPlaceholders: ["custom_fee"],
        validationStatus: "needs_attention",
        updatedAt: uploadedAt
      }
    ]);
  });

  it("creates a first version from template text and stores validation metadata", async () => {
    const { client, calls } = createClient();
    const store = createDocumentTemplatePrismaStore(client);

    await store.create({
      workspaceId: "workspace-1",
      name: "KP Template",
      documentType: "kp",
      language: "en",
      attachmentId: "attachment-1",
      templateText: "{{ client_name }} {{ custom_fee }}",
      uploadedByUserId: "user-1",
      changeNote: "Initial KP template"
    });

    expect(calls).toContainEqual({
      method: "documentTemplateVersion.create",
      args: {
        data: {
          templateId: "template-1",
          version: 1,
          attachmentId: "attachment-1",
          detectedPlaceholders: ["client_name", "custom_fee"],
          unknownPlaceholders: ["custom_fee"],
          validationStatus: "needs_attention",
          uploadedByUserId: "user-1",
          changeNote: "Initial KP template"
        }
      }
    });
  });

  it("creates attachment metadata before creating a template from an upload", async () => {
    const { client, calls } = createClient();
    const store = createDocumentTemplatePrismaStore(client);

    await store.createFromUpload({
      workspaceId: "workspace-1",
      name: "KP Template",
      documentType: "kp",
      language: "en",
      fileName: "KP Template.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sizeBytes: 2048,
      templateText: "{{ client_name }}",
      uploadedByUserId: "user-1"
    });

    expect(calls[0]).toEqual({
      method: "attachment.create",
      args: {
        data: {
          workspaceId: "workspace-1",
          storageKey: "workspaces/workspace-1/templates/kp/kp-template.docx",
          fileName: "KP Template.docx",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          sizeBytes: 2048,
          status: "draft",
          source: "template_upload",
          createdByUserId: "user-1"
        }
      }
    });
  });
});
