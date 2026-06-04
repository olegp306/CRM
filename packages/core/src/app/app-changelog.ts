export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.25",
  title: "Lead table and client linking release",
  items: [
    "Lead tables now default to client, project, commercial, contact, and source columns with saved column order, widths, and visibility.",
    "Telegram and web lead creation now link to an existing client or create a client when enough contact data is present.",
    "Lead cards now edit fields in the same order as the default table and include a confirmed delete-lead action."
  ]
};
