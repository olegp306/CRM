import { getDictionary } from "@app/ui";
import { SettingsDangerZone } from "./danger-zone";

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
      <div className="grid gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Agent routing</h2>
          <div className="mt-2 grid gap-3">
            <a href="/settings/crm-orchestrator" className="rounded-lg border border-border bg-white p-4 transition hover:bg-muted">
              <h3 className="text-base font-semibold">CRM orchestrator</h3>
              <p className="mt-2 text-sm text-muted-foreground">Top-level routing prompt for Telegram and assistant requests.</p>
            </a>
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Specialized agents</h2>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <a href="/settings/ai-intake" className="rounded-lg border border-border bg-white p-4 transition hover:bg-muted">
              <h3 className="text-base font-semibold">AI intake</h3>
              <p className="mt-2 text-sm text-muted-foreground">Metaprompt and model for client material analysis.</p>
            </a>
            <a href="/settings/crm-entity-extractor" className="rounded-lg border border-border bg-white p-4 transition hover:bg-muted">
              <h3 className="text-base font-semibold">CRM entity extractor</h3>
              <p className="mt-2 text-sm text-muted-foreground">Facts, events, follow-ups, people, organizations, and tags.</p>
            </a>
          </div>
        </div>
      </div>
      <SettingsDangerZone />
    </section>
  );
}
