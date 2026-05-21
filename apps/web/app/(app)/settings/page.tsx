import { getDictionary } from "@app/ui";

const dictionary = getDictionary("en");

export default function SettingsPage() {
  return (
    <section className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{dictionary.settings.title}</h1>
        <p className="text-sm text-muted-foreground">Workspace preferences for language, branding, team, and modules.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <a href="/settings/language" className="rounded-lg border border-border bg-white p-4 transition hover:bg-muted">
          <h2 className="text-base font-semibold">{dictionary.settings.language}</h2>
          <p className="mt-2 text-sm text-muted-foreground">English is active. German and Russian dictionaries are ready.</p>
        </a>
        <a href="/settings/branding" className="rounded-lg border border-border bg-white p-4 transition hover:bg-muted">
          <h2 className="text-base font-semibold">{dictionary.settings.branding}</h2>
          <p className="mt-2 text-sm text-muted-foreground">Workspace name and primary color drive the app shell.</p>
        </a>
        <a href="/settings/price-table" className="rounded-lg border border-border bg-white p-4 transition hover:bg-muted">
          <h2 className="text-base font-semibold">Price table</h2>
          <p className="mt-2 text-sm text-muted-foreground">Standard BGF pricing ranges for L01 lead intake.</p>
        </a>
        <a href="/settings/templates" className="rounded-lg border border-border bg-white p-4 transition hover:bg-muted">
          <h2 className="text-base font-semibold">Templates</h2>
          <p className="mt-2 text-sm text-muted-foreground">DOCX placeholder validation and document template versions.</p>
        </a>
      </div>
    </section>
  );
}
