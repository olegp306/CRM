"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@app/db";
import { getWorkspaceSession } from "../../workspace-session";

export async function updateClientAction(formData: FormData): Promise<void> {
  const session = await getWorkspaceSession();
  const id = getRequiredFormValue(formData, "id");

  await prisma.client.update({
    where: { id, workspaceId: session.workspaceId },
    data: {
      name: getRequiredFormValue(formData, "name"),
      clientType: getRequiredFormValue(formData, "clientType"),
      language: getOptionalFormValue(formData, "language"),
      whatsapp: getOptionalFormValue(formData, "whatsapp"),
      email: getOptionalFormValue(formData, "email"),
      phone: getOptionalFormValue(formData, "phone"),
      address: getOptionalFormValue(formData, "address"),
      source: getOptionalFormValue(formData, "source"),
      referredBy: getOptionalFormValue(formData, "referredBy"),
      notes: getOptionalFormValue(formData, "notes"),
      status: getRequiredFormValue(formData, "status")
    }
  });

  revalidatePath("/clients");
}

function getOptionalFormValue(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getRequiredFormValue(formData: FormData, key: string): string {
  const value = getOptionalFormValue(formData, key);
  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}
