export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.16",
  title: "Telegram reminders accumulate",
  items: [
    "Telegram reply reminders now create a separate CRM calendar action for every scheduled reminder.",
    "Multiple reminders on the same lead accumulate instead of only leaving the latest date on the lead follow-up field.",
    "A regression test covers two replied reminders creating two independent calendar actions."
  ]
};
