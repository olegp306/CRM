import { getWorkspaceSession } from "../../../workspace-session";
import { CRM_ENTITY_EXTRACTOR_MODEL_OPTIONS, getCrmEntityExtractorSetting } from "../ai-intake/ai-intake-store";
import { updateCrmEntityExtractorSettingsAction } from "./actions";

export default async function CrmEntityExtractorSettingsPage() {
  const session = await getWorkspaceSession();
  const setting = await getCrmEntityExtractorSetting(session.workspaceId);

  return (
    <section className="grid gap-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Specialized agent</p>
        <h1 className="text-2xl font-semibold">CRM entity extractor</h1>
        <p className="text-sm text-muted-foreground">
          Configure the agent that extracts facts, events, follow-ups, people, organizations, and tags after CRM orchestrator routing.
        </p>
      </div>

      <form action={updateCrmEntityExtractorSettingsAction} className="grid gap-4 rounded-lg border border-border bg-white p-4">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-foreground">Entity extraction model</span>
          <select name="model" defaultValue={setting.model} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
            {CRM_ENTITY_EXTRACTOR_MODEL_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-foreground">CRM entity extractor metaprompt</span>
          <textarea
            name="prompt"
            defaultValue={setting.prompt}
            className="min-h-72 rounded-md border border-border px-3 py-2 text-sm leading-6"
          />
        </label>

        <div className="rounded-lg border border-border bg-muted p-3 text-xs leading-5 text-muted-foreground">
          Current role: <span className="font-semibold text-foreground">{setting.role}</span>. This agent only extracts CRM
          entities; routing and mutations stay with the orchestrator and specialized execution layers.
        </div>

        <button type="submit" className="w-fit rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-white">
          Save CRM entity extractor settings
        </button>
      </form>
    </section>
  );
}
