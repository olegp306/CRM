"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AssistantDrawer } from "@/components/assistant-drawer";
import { AppMobileTabs } from "@/components/app-mobile-tabs";
import { AppSidebar } from "@/components/app-sidebar";
import { getRoutePendingPresentation, getRoutePendingPreview } from "@/components/app-transition";
import { cn } from "@app/ui";

type AppChromeChangelog = {
  version: string;
  title: string;
  items: string[];
};

type AppChromeProps = {
  children: ReactNode;
  primaryStyle: CSSProperties;
  workspaceName: string;
  userName: string;
  appVersion: string;
  changelog: AppChromeChangelog;
};

export function AppChrome({ children, primaryStyle, workspaceName, userName, appVersion, changelog }: AppChromeProps) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const isPending = pendingHref !== null;
  const pendingPresentation = getRoutePendingPresentation(isPending);
  const pendingPreview = getRoutePendingPreview(pendingHref);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  return (
    <div
      className="grid min-h-screen grid-cols-1 bg-background text-foreground lg:grid-cols-[248px_minmax(0,1fr)]"
      style={primaryStyle}
    >
      <AppSidebar
        pathname={pathname}
        pendingHref={pendingHref}
        brandName={workspaceName}
        appVersion={appVersion}
        onVersionClick={() => setIsChangelogOpen(true)}
        onNavigate={setPendingHref}
        locale="en"
      />
      <div className="min-w-0">
        <header className="flex h-14 items-center justify-between border-b border-border bg-white px-4 lg:justify-end lg:px-6">
          <button
            type="button"
            onClick={() => setIsChangelogOpen(true)}
            className="rounded-md border border-border bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground transition hover:text-foreground lg:hidden"
            aria-label={`Mobile version marker v${appVersion}. Open changelog for version ${appVersion}`}
          >
            v{appVersion}
          </button>
          <p className="text-xs font-semibold text-muted-foreground">{userName}</p>
        </header>
        <AppMobileTabs pathname={pathname} pendingHref={pendingHref} onNavigate={setPendingHref} locale="en" />
        <main className="relative min-w-0 p-4 lg:p-6" aria-busy={isPending ? true : undefined}>
          <div className={cn("transition duration-150", pendingPresentation.contentClassName)}>
            {pendingPreview ? <RoutePendingPreview title={pendingPreview.title} description={pendingPreview.description} /> : children}
          </div>
        </main>
      </div>
      <AssistantDrawer />
      {isChangelogOpen ? <ChangelogDialog changelog={changelog} onClose={() => setIsChangelogOpen(false)} /> : null}
    </div>
  );
}

function RoutePendingPreview({ title, description }: { title: string; description: string }) {
  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="min-h-32 rounded-lg border border-border bg-white" />
    </section>
  );
}

function ChangelogDialog({ changelog, onClose }: { changelog: AppChromeChangelog; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/35 px-4" role="presentation" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-changelog-title"
        className="flex max-h-[82vh] w-full max-w-lg flex-col rounded-lg border border-border bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">v{changelog.version}</p>
            <h2 id="app-changelog-title" className="mt-1 text-lg font-semibold text-foreground">
              {changelog.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700"
          >
            Close
          </button>
        </div>
        <ul className="mt-4 grid gap-2 overflow-y-auto pr-1 text-sm text-muted-foreground">
          {changelog.items.map((item) => (
            <li key={item} className="rounded-md border border-border bg-muted/40 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
