import { describe, expect, it } from "vitest";
import { getAssistantUploadKind } from "./upload-source-material";

describe("assistant upload source material", () => {
  it("detects photo, pdf, docx, and other upload kinds", () => {
    expect(getAssistantUploadKind("image/jpeg", "photo.jpg")).toBe("photo");
    expect(getAssistantUploadKind("application/pdf", "brief.pdf")).toBe("pdf");
    expect(getAssistantUploadKind("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "kp.docx")).toBe("docx");
    expect(getAssistantUploadKind("text/plain", "notes.txt")).toBe("text");
    expect(getAssistantUploadKind("application/octet-stream", "archive.bin")).toBe("other");
  });
});
