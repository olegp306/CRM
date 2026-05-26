import { createWorkspaceThemeStyle } from "@app/ui";
import { getWorkspaceSession } from "../../../workspace-session";
import { updateBrandingSettings } from "./actions";

const themeOptions = [
  { id: "light", label: "Studio", swatches: ["bg-[#f8fafa]", "bg-[#0f766e]", "bg-[#4f5b59]"] },
  { id: "nocturne", label: "Nocturne", swatches: ["bg-[#121413]", "bg-[#84ccbe]", "bg-[#a7b1ad]"] },
  { id: "graphite", label: "Graphite", swatches: ["bg-[#0c0e11]", "bg-[#93c5fd]", "bg-[#a4aeba]"] },
  { id: "warm", label: "Sage", swatches: ["bg-[#f6f8f3]", "bg-[#3f795d]", "bg-[#5b6858]"] }
] as const;

export default async function BrandingSettingsPage() {
  const session = await getWorkspaceSession();
  const previewStyle = createWorkspaceThemeStyle({
    primaryColor: session.primaryColor,
    themePreference: session.themePreference
  });

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Branding</h1>
        <p className="text-sm text-muted-foreground">Set the delivered CRM name, accent color, and compact interface theme.</p>
      </div>

      <form action={updateBrandingSettings} className="grid gap-4 rounded-lg border border-border bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
          <label className="grid gap-1 text-sm font-medium">
            Workspace name
            <input
              name="workspaceName"
              defaultValue={session.workspaceName}
              className="h-10 rounded-md border border-border bg-white px-3 text-sm"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Accent
            <input
              name="primaryColor"
              type="color"
              defaultValue={session.primaryColor}
              className="h-10 rounded-md border border-border bg-white px-2"
            />
          </label>
        </div>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Theme</legend>
          <div className="inline-flex w-fit rounded-lg border border-border bg-muted p-1">
            {themeOptions.map((theme) => (
              <label
                key={theme.id}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold ${
                  session.themePreference === theme.id ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="themePreference"
                  value={theme.id}
                  defaultChecked={session.themePreference === theme.id}
                  className="sr-only"
                />
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex overflow-hidden rounded-full border border-border">
                    {theme.swatches.map((swatch) => (
                      <span key={swatch} className={`h-3 w-3 ${swatch}`} />
                    ))}
                  </span>
                  {theme.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4" style={previewStyle}>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{session.workspaceName}</p>
            <p className="text-xs text-muted-foreground">Theme preview</p>
          </div>
          <span className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
            Active
          </span>
        </div>

        <button type="submit" className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Save branding
        </button>
      </form>
    </section>
  );
}
