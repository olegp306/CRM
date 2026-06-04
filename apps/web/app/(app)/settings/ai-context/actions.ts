"use server";

import { revalidatePath } from "next/cache";
import { getWorkspaceSession } from "../../../workspace-session";
import { WORKSPACE_PEOPLE_CONTEXT_MODEL_OPTIONS, saveWorkspacePeopleContextSetting } from "../ai-intake/ai-intake-store";

const allowedModels = new Set(WORKSPACE_PEOPLE_CONTEXT_MODEL_OPTIONS.map((option) => option.id));

export async function updateWorkspacePeopleContextSettingsAction(formData: FormData): Promise<void> {
  const session = await getWorkspaceSession();
  const model = String(formData.get("model") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();

  if (!allowedModels.has(model as never)) {
    throw new Error("Unsupported AI people context mode.");
  }

  if (prompt.length < 40) {
    throw new Error("AI people context must be at least 40 characters.");
  }

  await saveWorkspacePeopleContextSetting({
    workspaceId: session.workspaceId,
    model,
    prompt
  });

  revalidatePath("/settings/ai-context");
}
