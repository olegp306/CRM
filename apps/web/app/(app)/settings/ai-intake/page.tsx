import { getWorkspaceSession } from "../../../workspace-session";
import { updateAiIntakeSettingsAction } from "./actions";
import { CLIENT_MATERIAL_ANALYSIS_MODEL_OPTIONS, getClientMaterialAnalysisSetting } from "./ai-intake-store";

export default async function AiIntakeSettingsPage() {
  const session = await getWorkspaceSession();
  const setting = await getClientMaterialAnalysisSetting(session.workspaceId);

  return (
    <section className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">AI intake</h1>
        <p className="text-sm text-muted-foreground">
          Configure the metaprompt and model used to analyze client source materials before lead creation.
        </p>
      </div>

      <form action={updateAiIntakeSettingsAction} className="grid gap-4 rounded-lg border border-border bg-white p-4">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-foreground">Analysis model</span>
          <select name="model" defaultValue={setting.model} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
            {CLIENT_MATERIAL_ANALYSIS_MODEL_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-foreground">Client material analysis metaprompt</span>
          <textarea
            name="prompt"
            defaultValue={setting.prompt}
            className="min-h-72 rounded-md border border-border px-3 py-2 text-sm leading-6"
          />
        </label>

        <div className="rounded-lg border border-border bg-muted p-3 text-xs leading-5 text-muted-foreground">
          Current role: <span className="font-semibold text-foreground">{setting.role}</span>. This prompt is used for mixed
          Telegram/Web text, PDFs, photos, documents, and audio transcripts.
        </div>

        <button type="submit" className="w-fit rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-white">
          Save AI intake settings
        </button>
      </form>
    </section>
  );
}
