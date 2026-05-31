"use server";

import { revalidatePath } from "next/cache";
import { getWorkspaceSession } from "../../../workspace-session";
import { CRM_ORCHESTRATOR_MODEL_OPTIONS, saveCrmOrchestratorSetting } from "../ai-intake/ai-intake-store";

const allowedModels = new Set(CRM_ORCHESTRATOR_MODEL_OPTIONS.map((option) => option.id));

export async function updateCrmOrchestratorSettingsAction(formData: FormData): Promise<void> {
  const session = await getWorkspaceSession();
  const model = String(formData.get("model") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();

  if (!allowedModels.has(model as never)) {
    throw new Error("Unsupported CRM orchestrator model.");
  }

  if (prompt.length < 40) {
    throw new Error("CRM orchestrator prompt must be at least 40 characters.");
  }

  await saveCrmOrchestratorSetting({
    workspaceId: session.workspaceId,
    model,
    prompt
  });

  revalidatePath("/settings/crm-orchestrator");
}
