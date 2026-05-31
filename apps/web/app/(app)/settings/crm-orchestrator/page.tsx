import { getWorkspaceSession } from "../../../workspace-session";
import { CRM_ORCHESTRATOR_MODEL_OPTIONS, getCrmOrchestratorSetting } from "../ai-intake/ai-intake-store";
import { updateCrmOrchestratorSettingsAction } from "./actions";

export default async function CrmOrchestratorSettingsPage() {
  const session = await getWorkspaceSession();
  const setting = await getCrmOrchestratorSetting(session.workspaceId);

  return (
    <section className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">CRM orchestrator</h1>
        <p className="text-sm text-muted-foreground">
          Configure the routing prompt and model used before specialized CRM agents handle Telegram and assistant requests.
        </p>
      </div>

      <form action={updateCrmOrchestratorSettingsAction} className="grid gap-4 rounded-lg border border-border bg-white p-4">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-foreground">Routing model</span>
          <select name="model" defaultValue={setting.model} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
            {CRM_ORCHESTRATOR_MODEL_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-foreground">CRM orchestrator metaprompt</span>
          <textarea
            name="prompt"
            defaultValue={setting.prompt}
            className="min-h-72 rounded-md border border-border px-3 py-2 text-sm leading-6"
          />
        </label>

        <div className="rounded-lg border border-border bg-muted p-3 text-xs leading-5 text-muted-foreground">
          Current role: <span className="font-semibold text-foreground">{setting.role}</span>. The orchestrator decides whether a
          message should create a lead, update a lead, search CRM, attach files, create reminders, or ask one clarification question.
        </div>

        <button type="submit" className="w-fit rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-white">
          Save CRM orchestrator settings
        </button>
      </form>
    </section>
  );
}
