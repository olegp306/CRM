import { createWorkspaceThemeStyle } from "@app/ui";

const previewStyle = createWorkspaceThemeStyle({ primaryColor: "#2563eb" });

export default function BrandingSettingsPage() {
  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Branding</h1>
        <p className="text-sm text-muted-foreground">Preview workspace name, logo, and primary color settings.</p>
      </div>
      <div className="rounded-lg border border-border bg-white p-4">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4" style={previewStyle}>
          <div>
            <p className="text-sm font-semibold">Reyzbikh architect CRM</p>
            <p className="text-xs text-muted-foreground">Primary color preview</p>
          </div>
          <span className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
            Active
          </span>
        </div>
      </div>
    </section>
  );
}
