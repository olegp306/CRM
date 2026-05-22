"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import type { SupportedLocale } from "@app/ui";
import { cn } from "@app/ui";
import { getAppNavigationItems, getNavigationDisplayHref } from "./app-navigation";

type AppMobileTabsProps = {
  locale?: SupportedLocale;
  pathname: string;
  pendingHref: string | null;
  onNavigate: (href: string) => void;
};

export function AppMobileTabs({ locale = "en", pathname, pendingHref, onNavigate }: AppMobileTabsProps) {
  const items = getAppNavigationItems(locale);
  const displayHref = getNavigationDisplayHref(pathname, pendingHref);

  function handleNavigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0 || href === pathname) {
      return;
    }

    onNavigate(href);
  }

  return (
    <nav className="border-b border-border bg-white lg:hidden" aria-label="Main navigation">
      <div className="flex gap-1 overflow-x-auto px-3 py-2">
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
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground",
                isDisplayed ? "bg-muted text-foreground" : null
              )}
            >
              <item.icon aria-hidden="true" className="h-3.5 w-3.5" />
              <span>{item.label}</span>
              {isPending ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
