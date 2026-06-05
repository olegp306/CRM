export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.26",
  title: "Feedback audit and release notes",
  items: [
    "The repository now includes a dated changelog for the work completed from 2026-06-04 noon through 2026-06-05.",
    "The release notes summarize the delivered lead table, inline editing, client linking, Telegram routing, undo, and reminder reliability changes.",
    "Current version metadata is bumped to 0.4.26 so feedback captured after this audit can be traced to the refreshed main build."
  ]
};
