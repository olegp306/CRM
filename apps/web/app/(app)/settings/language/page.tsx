import { getDictionary, supportedLocales } from "@app/ui";

export default function LanguageSettingsPage() {
  const dictionary = getDictionary("en");

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{dictionary.settings.language}</h1>
        <p className="text-sm text-muted-foreground">Choose the workspace interface language.</p>
      </div>
      <div className="rounded-lg border border-border bg-white p-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {supportedLocales.map((locale) => (
            <button
              key={locale}
              type="button"
              className="h-10 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              {locale.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
