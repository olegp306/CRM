export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.8",
  title: "Telegram search and reply fixes",
  items: [
    "Telegram search mode now shows a compact one-line header and lead ID buttons.",
    "Telegram search results render lead IDs in bold instead of showing raw HTML tags.",
    "Reply-based lead reminders and notes stay resilient when audit or calendar side effects fail.",
    "The CRM orchestrator default prompt now treats Oleg and Ekaterina as internal actors, not clients."
  ]
};
