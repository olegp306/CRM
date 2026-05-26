import { describe, expect, it } from "vitest";
import { createAssistantAttachmentFromFile, getAssistantUploadKind } from "./upload-source-material";

describe("assistant upload source material", () => {
  it("detects photo, pdf, docx, and other upload kinds", () => {
    expect(getAssistantUploadKind("image/jpeg", "photo.jpg")).toBe("photo");
    expect(getAssistantUploadKind("application/pdf", "brief.pdf")).toBe("pdf");
    expect(getAssistantUploadKind("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "kp.docx")).toBe("docx");
    expect(getAssistantUploadKind("text/plain", "notes.txt")).toBe("text");
    expect(getAssistantUploadKind("application/octet-stream", "archive.bin")).toBe("other");
  });

  it("creates a text attachment with base64 content", async () => {
    const bytes = new TextEncoder().encode("hello");
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const file = {
      name: "notes.txt",
      type: "text/plain",
      arrayBuffer: async () => buffer
    } as File;

    const attachment = await createAssistantAttachmentFromFile(file);

    expect(attachment.kind).toBe("text");
    expect(attachment.fileName).toBe("notes.txt");
    expect(attachment.mimeType).toBe("text/plain");
    expect(attachment.base64).toBe("aGVsbG8=");
  });
});
