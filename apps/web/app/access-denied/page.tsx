import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
      <section className="w-full max-w-sm rounded-lg border border-border bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workspace CRM</p>
        <h1 className="mt-3 text-2xl font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This Gmail account is not on the CRM admin allowlist. Please sign in with an approved account.
        </p>
        <Link href="/api/auth/signout?callbackUrl=/login" className="mt-6 block rounded-md bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground">
          Switch Google account
        </Link>
      </section>
    </main>
  );
}
