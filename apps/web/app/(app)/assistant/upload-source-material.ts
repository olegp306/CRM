import type { AssistantChannelAttachment } from "@app/assistant";

export function getAssistantUploadKind(mimeType: string, fileName: string): AssistantChannelAttachment["kind"] {
  const lowerName = fileName.toLowerCase();

  if (mimeType.startsWith("image/")) return "photo";
  if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) return "pdf";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    return "docx";
  }
  if (mimeType.startsWith("text/") || lowerName.endsWith(".txt")) return "text";

  return "other";
}

export async function createAssistantAttachmentFromFile(file: File): Promise<AssistantChannelAttachment> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(bytes).toString("base64");

  return {
    id: `${Date.now()}-${file.name}`,
    kind: getAssistantUploadKind(file.type, file.name),
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    base64
  };
}
