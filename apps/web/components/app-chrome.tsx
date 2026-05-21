"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AssistantDrawer } from "@/components/assistant-drawer";
import { AppSidebar } from "@/components/app-sidebar";
import { getRoutePendingPresentation, getRoutePendingPreview } from "@/components/app-transition";
import { cn } from "@app/ui";

type AppChromeProps = {
  children: ReactNode;
  primaryStyle: CSSProperties;
  workspaceName: string;
  workspaceDescription: string;
  userName: string;
  appVersion: string;
};

export function AppChrome({ children, primaryStyle, workspaceName, workspaceDescription, userName, appVersion }: AppChromeProps) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
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
      <AppSidebar pathname={pathname} pendingHref={pendingHref} appVersion={appVersion} onNavigate={setPendingHref} locale="en" />
      <div className="min-w-0">
        <header className="flex h-14 items-center justify-between border-b border-border bg-white px-4 lg:px-6">
          <div>
            <p className="text-sm font-semibold">{workspaceName}</p>
            <p className="text-xs text-muted-foreground">{workspaceDescription}</p>
          </div>
          <p className="text-xs font-semibold text-muted-foreground">{userName}</p>
        </header>
        <main className="relative min-w-0 p-4 lg:p-6" aria-busy={isPending ? true : undefined}>
          <div className={cn("transition duration-150", pendingPresentation.contentClassName)}>
            {pendingPreview ? <RoutePendingPreview title={pendingPreview.title} description={pendingPreview.description} /> : children}
          </div>
        </main>
      </div>
      <AssistantDrawer />
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
