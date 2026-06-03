export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.6",
  title: "Telegram search menu hotfix",
  items: [
    "Fixed Search Lead from the Telegram command menu when the database has leads without direct contact fields.",
    "Telegram bot menu now exposes new lead and search lead command entries.",
    "Search mode now opens with the latest 5 leads, Telegram lead-card buttons, and next-page navigation.",
    "Web changelog dialog now keeps current notes visible and scrolls through longer release history.",
    "Telegram lead create/update flow now explains the simple workflow on start, help, and capability questions.",
    "Use new lead to start creating leads and search lead to enter lead search mode.",
    "Search results can open a lead card directly in Telegram before sending updates.",
    "Lead updates, notes, reminders, and extra files now require replying to a Telegram lead card.",
    "Default CRM orchestrator prompts document the same command-area rules for future prompt resets."
  ]
};
