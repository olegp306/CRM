import { parseTelegramRuntimeConfig } from "@app/db";
import { getWorkspaceSession } from "../../../workspace-session";
import { TELEGRAM_RUNTIME_MODEL_OPTIONS, getTelegramRuntimeSetting } from "../ai-intake/ai-intake-store";
import { updateTelegramRuntimeSettingsAction } from "./actions";

export default async function TelegramRuntimeSettingsPage() {
  const session = await getWorkspaceSession();
  const setting = await getTelegramRuntimeSetting(session.workspaceId);
  const config = parseTelegramRuntimeConfig(setting.prompt);

  return (
    <section className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Telegram runtime</h1>
        <p className="text-sm text-muted-foreground">
          Switch the Telegram bot between the current legacy flow and the first LangGraph CRM orchestrator.
        </p>
      </div>

      <form action={updateTelegramRuntimeSettingsAction} className="grid gap-4 rounded-lg border border-border bg-white p-4">
        <fieldset className="grid gap-2 text-sm">
          <legend className="font-medium text-foreground">Runtime</legend>
          <label className="flex items-start gap-3 rounded-md border border-border p-3">
            <input type="radio" name="runtime" value="legacy" defaultChecked={config.runtime === "legacy"} className="mt-1" />
            <span>
              <span className="block font-semibold">Legacy</span>
              <span className="block text-muted-foreground">Use the current Telegram orchestration path.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-md border border-border p-3">
            <input type="radio" name="runtime" value="langgraph" defaultChecked={config.runtime === "langgraph"} className="mt-1" />
            <span>
              <span className="block font-semibold">LangGraph</span>
              <span className="block text-muted-foreground">
                Route Telegram messages through the graph orchestrator before lead, reminder, and context-note tools run.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3">
            <input type="radio" name="runtime" value="langgraph_primary" defaultChecked={config.runtime === "langgraph_primary"} className="mt-1" />
            <span>
              <span className="block font-semibold text-amber-950">LangGraph primary test</span>
              <span className="block text-amber-900">
                Test-bot mode: route natural Telegram messages through LangGraph first, then execute existing CRM tools.
              </span>
            </span>
          </label>
        </fieldset>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-foreground">LangGraph model</span>
          <select name="model" defaultValue={setting.model} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
            {TELEGRAM_RUNTIME_MODEL_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-lg border border-border bg-muted p-3 text-xs leading-5 text-muted-foreground">
          Current runtime: <span className="font-semibold text-foreground">{config.runtime}</span>. Keep production away from
          LangGraph primary until it is verified with the separate test Telegram bot and test database.
        </div>

        <button type="submit" className="w-fit rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-white">
          Save Telegram runtime
        </button>
      </form>
    </section>
  );
}
