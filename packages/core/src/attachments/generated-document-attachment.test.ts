import { describe, expect, it } from "vitest";
import { createGeneratedDocumentAttachmentMetadata } from "./generated-document-attachment";

describe("createGeneratedDocumentAttachmentMetadata", () => {
  it("creates DOCX metadata for a generated document", () => {
    expect(
      createGeneratedDocumentAttachmentMetadata({
        workspaceId: "workspace-1",
        documentId: "D-20260521-message-4",
        documentType: "kp",
        format: "docx",
        createdByUserId: "user-1"
      })
    ).toEqual({
      workspaceId: "workspace-1",
      storageKey: "workspaces/workspace-1/generated/kp/d-20260521-message-4.docx",
      fileName: "D-20260521-message-4.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sizeBytes: 0,
      status: "current",
      source: "generated_document",
      createdByUserId: "user-1"
    });
  });

  it("creates PDF metadata for a generated document", () => {
    expect(
      createGeneratedDocumentAttachmentMetadata({
        workspaceId: "workspace-1",
        documentId: "D-20260521-message-4",
        documentType: "kp",
        format: "pdf"
      }).mimeType
    ).toBe("application/pdf");
  });
});
