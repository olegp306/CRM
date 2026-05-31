"use server";

import { revalidatePath } from "next/cache";
import { getWorkspaceSession } from "../../../workspace-session";
import { CLIENT_MATERIAL_ANALYSIS_MODEL_OPTIONS, saveClientMaterialAnalysisSetting } from "./ai-intake-store";

const allowedModels = new Set(CLIENT_MATERIAL_ANALYSIS_MODEL_OPTIONS.map((option) => option.id));

export async function updateAiIntakeSettingsAction(formData: FormData): Promise<void> {
  const session = await getWorkspaceSession();
  const model = String(formData.get("model") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();

  if (!allowedModels.has(model as never)) {
    throw new Error("Unsupported AI intake model.");
  }

  if (prompt.length < 40) {
    throw new Error("AI intake prompt must be at least 40 characters.");
  }

  await saveClientMaterialAnalysisSetting({
    workspaceId: session.workspaceId,
    model,
    prompt
  });

  revalidatePath("/settings/ai-intake");
}
