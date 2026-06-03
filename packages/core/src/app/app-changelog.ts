export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.7",
  title: "Web CRM calendar",
  items: [
    "Lead cards now show an action calendar filtered to the selected lead.",
    "Action calendars can move between months and switch between calendar and list views.",
    "Calendar events show follow-up, reminder, birthday, yearly, and event badges.",
    "The Today page now has a shared workspace CRM calendar with planned actions from all leads.",
    "Today calendar entries can open the related lead for follow-up work."
  ]
};
