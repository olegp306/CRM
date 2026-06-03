export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.17",
  title: "Telegram reminders stay in the calendar",
  items: [
    "Telegram reply reminders now create a separate CRM calendar action for every scheduled reminder.",
    "Multiple reminders on the same lead accumulate instead of only leaving the latest date on the lead follow-up field.",
    "Russian future-action phrases such as 'in 11 days we need to tell them' are detected as reminders even without an explicit reminder verb."
  ]
};
