export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.13",
  title: "Telegram reply routing fix",
  items: [
    "Telegram replies to an opened lead card now stay attached to that lead even when the chat is still in search mode.",
    "Reply updates, notes, and reminders no longer trigger a fresh search result list.",
    "The regression test covers search mode, opening a lead card, and then replying to update the selected lead."
  ]
};
