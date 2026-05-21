import { describe, expect, it } from "vitest";
import { createTemplateAttachmentMetadata } from "./template-attachment";

describe("createTemplateAttachmentMetadata", () => {
  it("creates stable template attachment metadata", () => {
    expect(
      createTemplateAttachmentMetadata({
        workspaceId: "workspace-1",
        documentType: "kp",
        fileName: "KP Angebot V1.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: 2048,
        createdByUserId: "user-1"
      })
    ).toEqual({
      workspaceId: "workspace-1",
      storageKey: "workspaces/workspace-1/templates/kp/kp-angebot-v1.docx",
      fileName: "KP Angebot V1.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sizeBytes: 2048,
      status: "draft",
      source: "template_upload",
      createdByUserId: "user-1"
    });
  });

  it("rejects non-docx template uploads", () => {
    expect(() =>
      createTemplateAttachmentMetadata({
        workspaceId: "workspace-1",
        documentType: "kp",
        fileName: "template.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048
      })
    ).toThrow("Template uploads must be DOCX files.");
  });
});
