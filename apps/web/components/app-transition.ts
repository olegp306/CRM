export type RoutePendingPresentation = {
  contentClassName: string;
  renderOverlay: boolean;
};

export type RoutePendingPreview = {
  href: string;
  title: string;
  description: string;
};

const routePendingPreviews: RoutePendingPreview[] = [
  {
    href: "/today",
    title: "Today",
    description: "Due follow-ups and time-sensitive L01 lead intake work."
  },
  {
    href: "/clients",
    title: "Clients",
    description: "People and companies connected to leads and projects."
  },
  {
    href: "/leads",
    title: "Leads",
    description: "Inbound and converted opportunities."
  },
  {
    href: "/projects",
    title: "Projects",
    description: "Project operations, tasks, decisions, and documents."
  },
  {
    href: "/outreach",
    title: "Outreach",
    description: "Cold targets and cadence execution."
  },
  {
    href: "/content",
    title: "Content",
    description: "Content cases, drafts, planning, and publication history."
  },
  {
    href: "/assistant/preview",
    title: "Assistant action preview",
    description: "Context capture, preview, permission blocking, and feedback signal rules."
  },
  {
    href: "/settings",
    title: "Settings",
    description: "Workspace preferences for language, branding, team, and modules."
  }
];

export function getRoutePendingPresentation(isPending: boolean): RoutePendingPresentation {
  return {
    contentClassName: isPending ? "pointer-events-none opacity-35 blur-[1px] grayscale" : "",
    renderOverlay: false
  };
}

export function getRoutePendingPreview(href: string | null): RoutePendingPreview | null {
  if (!href) {
    return null;
  }

  return routePendingPreviews.find((preview) => preview.href === href) ?? null;
}
