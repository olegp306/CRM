export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.21",
  title: "Theme polish and copyable Telegram guide",
  items: [
    "Theme choices in Settings now visibly switch as soon as the user clicks a theme option.",
    "Lead cards and lead tables use theme-aware surfaces so dark themes no longer leave white unreadable patches.",
    "The Telegram CRM guide renders numbered steps correctly and lets users copy command examples with one click."
  ]
};
