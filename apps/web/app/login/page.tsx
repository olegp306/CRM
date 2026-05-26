import Link from "next/link";
import { isGoogleAdminAuthConfigured } from "@/auth";

export default function LoginPage() {
  const isConfigured = isGoogleAdminAuthConfigured();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
      <section className="w-full max-w-sm rounded-lg border border-border bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workspace CRM</p>
        <h1 className="mt-3 text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">Access is limited to approved Gmail admin accounts.</p>
        {isConfigured ? (
          <Link
            href="/api/auth/signin/google?callbackUrl=/leads"
            className="mt-6 block rounded-md bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground"
          >
            Continue with Google
          </Link>
        ) : (
          <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Google sign-in is not configured for this environment.
          </p>
        )}
      </section>
    </main>
  );
}
