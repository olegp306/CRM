"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@app/db";
import { getWorkspaceSession } from "../../workspace-session";

export async function updateProjectAction(formData: FormData): Promise<void> {
  const session = await getWorkspaceSession();
  const id = getRequiredFormValue(formData, "id");

  await prisma.project.update({
    where: { id, workspaceId: session.workspaceId },
    data: {
      projectName: getRequiredFormValue(formData, "projectName"),
      projectAddress: getOptionalFormValue(formData, "projectAddress"),
      projectType: getOptionalFormValue(formData, "projectType"),
      currentPhase: getOptionalFormValue(formData, "currentPhase"),
      status: getRequiredFormValue(formData, "status"),
      bgfM2: getOptionalDecimalFormValue(formData, "bgfM2"),
      wohnflaecheM2: getOptionalDecimalFormValue(formData, "wohnflaecheM2"),
      totalNetEur: getOptionalDecimalFormValue(formData, "totalNetEur"),
      totalGrossEur: getOptionalDecimalFormValue(formData, "totalGrossEur"),
      notes: getOptionalFormValue(formData, "notes")
    }
  });

  revalidatePath("/projects");
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

function getOptionalDecimalFormValue(formData: FormData, key: string): string | null {
  return getOptionalFormValue(formData, key);
}
