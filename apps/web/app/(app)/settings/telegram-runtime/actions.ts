"use server";

import { createTelegramRuntimePrompt } from "@app/db";
import { revalidatePath } from "next/cache";
import { getWorkspaceSession } from "../../../workspace-session";
import { TELEGRAM_RUNTIME_MODEL_OPTIONS, saveTelegramRuntimeSetting } from "../ai-intake/ai-intake-store";

const allowedModels = new Set(TELEGRAM_RUNTIME_MODEL_OPTIONS.map((option) => option.id));
const allowedRuntimes = new Set(["legacy", "langgraph"]);

export async function updateTelegramRuntimeSettingsAction(formData: FormData): Promise<void> {
  const session = await getWorkspaceSession();
  const runtime = String(formData.get("runtime") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();

  if (!allowedRuntimes.has(runtime)) {
    throw new Error("Unsupported Telegram runtime.");
  }

  if (!allowedModels.has(model as never)) {
    throw new Error("Unsupported Telegram LangGraph model.");
  }

  await saveTelegramRuntimeSetting({
    workspaceId: session.workspaceId,
    model,
    prompt: createTelegramRuntimePrompt({ runtime: runtime === "langgraph" ? "langgraph" : "legacy" })
  });

  revalidatePath("/settings/telegram-runtime");
  revalidatePath("/settings");
}
