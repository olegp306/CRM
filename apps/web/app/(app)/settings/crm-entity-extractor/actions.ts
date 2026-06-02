"use server";

import { revalidatePath } from "next/cache";
import { getWorkspaceSession } from "../../../workspace-session";
import { CRM_ENTITY_EXTRACTOR_MODEL_OPTIONS, saveCrmEntityExtractorSetting } from "../ai-intake/ai-intake-store";

const allowedModels = new Set(CRM_ENTITY_EXTRACTOR_MODEL_OPTIONS.map((option) => option.id));

export async function updateCrmEntityExtractorSettingsAction(formData: FormData): Promise<void> {
  const session = await getWorkspaceSession();
  const model = String(formData.get("model") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();

  if (!allowedModels.has(model as never)) {
    throw new Error("Unsupported CRM entity extractor model.");
  }

  if (prompt.length < 40) {
    throw new Error("CRM entity extractor prompt must be at least 40 characters.");
  }

  await saveCrmEntityExtractorSetting({
    workspaceId: session.workspaceId,
    model,
    prompt
  });

  revalidatePath("/settings/crm-entity-extractor");
}
