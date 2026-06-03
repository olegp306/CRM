export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.15",
  title: "Telegram callback resilience",
  items: [
    "Telegram callback acknowledgements are now best-effort, so a stale button response can no longer crash the worker.",
    "The Telegram worker keeps processing normal messages after Telegram returns 400 for answerCallbackQuery.",
    "A regression test covers stale callback failures followed by a regular lead message in the same polling batch."
  ]
};
