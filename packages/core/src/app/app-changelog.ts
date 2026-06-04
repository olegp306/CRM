export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.24",
  title: "Merged CRM orchestrator prompt",
  items: [
    "The CRM orchestrator default prompt now uses one clean markdown source shared with the documented settings prompt.",
    "The merged prompt keeps support/search/reply-routing guidance from test while adding the newer Telegram next-client and reminder-date rules.",
    "Release metadata now tracks the merged orchestrator prompt as version 0.4.24."
  ]
};
