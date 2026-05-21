"use server";

import { revalidatePath } from "next/cache";
import { createTemplateAttachmentMetadata } from "@app/core";
import { createObjectStorageFromEnv } from "@app/core/storage";
import { getWorkspaceSession } from "../../../workspace-session";
import { createDocumentTemplateFromUpload } from "./template-store";

export async function uploadDocumentTemplateAction(formData: FormData): Promise<void> {
  const session = await getWorkspaceSession();
  const file = formData.get("templateFile");
  const name = getRequiredFormValue(formData, "name");
  const documentType = getRequiredFormValue(formData, "documentType");
  const language = getRequiredFormValue(formData, "language");
  const templateText = getRequiredFormValue(formData, "templateText");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Template DOCX file is required.");
  }

  const attachmentMetadata = createTemplateAttachmentMetadata({
    workspaceId: session.workspaceId,
    documentType,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    createdByUserId: session.userId
  });
  await createObjectStorageFromEnv().putObject({
    key: attachmentMetadata.storageKey,
    body: new Uint8Array(await file.arrayBuffer()),
    contentType: file.type
  });

  await createDocumentTemplateFromUpload({
    workspaceId: session.workspaceId,
    name,
    documentType,
    language,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    templateText,
    uploadedByUserId: session.userId,
    changeNote: "Uploaded from Template Manager"
  });

  revalidatePath("/settings/templates");
}

function getRequiredFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}
