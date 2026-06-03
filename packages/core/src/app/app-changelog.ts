export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.4",
  title: "Telegram lead commands and search flow",
  items: [
    "Telegram lead create/update flow now explains the simple workflow on /start, /help, and capability questions.",
    "Use /new lead to start creating leads and /search lead to enter lead search mode.",
    "Search results can open a lead card directly in Telegram before sending updates.",
    "Lead updates, notes, reminders, and extra files now require replying to a Telegram lead card.",
    "Default CRM orchestrator prompts document the same command-area rules for future prompt resets."
  ]
};
