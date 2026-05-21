export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-950 p-6 text-white">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header>
          <h1 className="text-2xl font-semibold">Platform Admin</h1>
          <p className="text-sm text-neutral-400">Internal SaaS operations and feedback review.</p>
        </header>
        {children}
      </div>
    </main>
  );
}
