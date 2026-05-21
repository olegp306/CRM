export default function ContentPage() {
  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Content</h1>
        <p className="text-sm text-muted-foreground">Content cases, drafts, planning, and publication history.</p>
      </div>
      <div className="rounded-lg border border-border bg-white p-4 text-sm text-muted-foreground">
        Content cases will render here.
      </div>
    </section>
  );
}
