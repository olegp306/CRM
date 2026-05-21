import { Bot, CalendarDays, FileText, FolderKanban, Home, Megaphone, Settings, UsersRound } from "lucide-react";
import { getDictionary, type SupportedLocale } from "@app/ui";

const navigationItems = [
  { key: "today", href: "/today", icon: Home },
  { key: "clients", href: "/clients", icon: UsersRound },
  { key: "leads", href: "/leads", icon: CalendarDays },
  { key: "projects", href: "/projects", icon: FolderKanban },
  { key: "outreach", href: "/outreach", icon: Megaphone },
  { key: "content", href: "/content", icon: FileText },
  { key: "assistant", href: "/assistant/preview", icon: Bot },
  { key: "settings", href: "/settings", icon: Settings }
] as const;

export function getAppNavigationItems(locale: SupportedLocale = "en") {
  const dictionary = getDictionary(locale);

  return navigationItems.map((item) => ({
    ...item,
    label: dictionary.navigation[item.key]
  }));
}

export function getNavigationPendingLabel(label: string): string {
  return `Loading ${label}...`;
}

export function getNavigationDisplayHref(pathname: string, pendingHref: string | null): string {
  return pendingHref ?? pathname;
}
