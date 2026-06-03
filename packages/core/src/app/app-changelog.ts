export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.9",
  title: "Telegram reply actions fix",
  items: [
    "Lead cards opened from Telegram search now remember their reply context.",
    "Replies to those Telegram lead cards can update lead fields instead of falling into server errors.",
    "Replies to opened lead cards can create reminder/history actions for the correct lead.",
    "A regression test now covers the search-to-open-to-reply Telegram workflow."
  ]
};
