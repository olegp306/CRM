import { getWorkspaceSession } from "../../../workspace-session";
import { WORKSPACE_PEOPLE_CONTEXT_MODEL_OPTIONS, getWorkspacePeopleContextSetting } from "../ai-intake/ai-intake-store";
import { updateWorkspacePeopleContextSettingsAction } from "./actions";

export default async function AiContextSettingsPage() {
  const session = await getWorkspaceSession();
  const setting = await getWorkspacePeopleContextSetting(session.workspaceId);

  return (
    <section className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">AI people context</h1>
        <p className="text-sm text-muted-foreground">
          Configure the shared people, roles, and project-operator context that is appended to CRM orchestrator, AI intake, and CRM
          entity extractor prompts.
        </p>
      </div>

      <form action={updateWorkspacePeopleContextSettingsAction} className="grid gap-4 rounded-lg border border-border bg-white p-4">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-foreground">Context mode</span>
          <select name="model" defaultValue={setting.model} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
            {WORKSPACE_PEOPLE_CONTEXT_MODEL_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-foreground">Shared AI context</span>
          <textarea
            name="prompt"
            defaultValue={setting.prompt}
            className="min-h-72 rounded-md border border-border px-3 py-2 text-sm leading-6"
          />
        </label>

        <div className="rounded-lg border border-border bg-muted p-3 text-xs leading-5 text-muted-foreground">
          Current role: <span className="font-semibold text-foreground">{setting.role}</span>. This context is not a standalone
          agent. It is attached to every major CRM AI prompt so internal operators are not mistaken for clients.
        </div>

        <button type="submit" className="w-fit rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-white">
          Save AI people context
        </button>
      </form>
    </section>
  );
}
