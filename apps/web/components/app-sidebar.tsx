"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import type { SupportedLocale } from "@app/ui";
import { cn } from "@app/ui";
import { getAppNavigationItems, getNavigationDisplayHref, getNavigationPendingLabel } from "./app-navigation";

type AppSidebarProps = {
  locale?: SupportedLocale;
  pathname: string;
  pendingHref: string | null;
  onNavigate: (href: string) => void;
};

export function AppSidebar({ locale = "en", pathname, pendingHref, onNavigate }: AppSidebarProps) {
  const items = getAppNavigationItems(locale);
  const pendingItem = items.find((item) => item.href === pendingHref);
  const displayHref = getNavigationDisplayHref(pathname, pendingHref);

  function handleNavigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0 || href === pathname) {
      return;
    }

    onNavigate(href);
  }

  return (
    <aside className="hidden border-r border-border bg-white px-4 py-5 lg:block">
      {pendingItem ? (
        <div className="fixed inset-x-0 top-0 z-50 h-1 bg-muted" role="status" aria-live="polite">
          <div className="h-full w-1/3 animate-pulse bg-primary" />
          <span className="sr-only">{getNavigationPendingLabel(pendingItem.label)}</span>
        </div>
      ) : null}
      <div className="mb-6 text-base font-semibold">Studio OS</div>
      <nav className="grid gap-1" aria-busy={pendingItem ? true : undefined}>
        {items.map((item) => {
          const isDisplayed = displayHref === item.href;
          const isPending = pendingHref === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={(event) => handleNavigate(event, item.href)}
              aria-current={isDisplayed ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
                isDisplayed ? "bg-muted text-foreground" : null
              )}
            >
              <item.icon aria-hidden="true" className="h-4 w-4" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {isPending ? <span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
