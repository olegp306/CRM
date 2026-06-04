export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.19",
  title: "Telegram guide and safer lead replies",
  items: [
    "Telegram help now links to a CRM user guide with copyable examples for new leads, search, replies, notes, and reminders.",
    "Workspace people context is shared with AI prompts so project operators are not mistaken for clients.",
    "Lead reply updates understand targeted field aliases more carefully, including phone, email, project address, BGF, dates, and budget."
  ]
};
