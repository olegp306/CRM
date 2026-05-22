export default function HomePage() {
  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">CRM SaaS v1</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal">Reyzbikh architect CRM</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            Architecture CRM foundation, ready for lead intake, assistant workflows, and module screens.
          </p>
        </div>
        <a
          href="/clients"
          className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm"
        >
          Open workspace
        </a>
      </section>
    </main>
  );
}
