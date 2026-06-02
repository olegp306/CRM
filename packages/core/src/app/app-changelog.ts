export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.2",
  title: "Lead search routing and safer test reset",
  items: [
    "Telegram lead search and CRM Orchestrator now understand human search phrases, including project titles, tags, locations, and recent lead lists.",
    "Lead names stay compact in Telegram confirmations, CRM cards, and search results.",
    "Version click in the web app opens concise release notes for the current build.",
    "Settings lead reset now clears lead context entities and calendar actions before deleting test leads.",
    "Telegram search results return CRM buttons with readable lead titles and filtered CRM result links."
  ]
};
