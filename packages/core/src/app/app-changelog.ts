export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.22",
  title: "Telegram guide navigation and safer copy",
  items: [
    "The Telegram CRM guide now has quick links for Create, Search, Update, and Reminder command sections.",
    "Guide example copy buttons now fall back to a textarea copy flow when the browser blocks the Clipboard API on local HTTP/IP pages.",
    "Guide tests cover the quick links, ordered steps, and resilient copy behavior."
  ]
};
