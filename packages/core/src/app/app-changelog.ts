export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.18",
  title: "Test and production deploys are isolated",
  items: [
    "The web app shows a visible TEST or STAGING badge for non-production environments.",
    "VM deployments now require an explicit test or production confirmation before web or Telegram services start.",
    "Telegram workers refuse to start when the bot environment, deployment environment, and database do not match."
  ]
};
