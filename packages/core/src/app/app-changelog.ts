export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.11",
  title: "Russian reminder date parsing",
  items: [
    "Telegram and Web reminders now understand Russian phrases like через два дня and через пару дней.",
    "Next-week weekday reminders like на следующей неделе во вторник вечером now resolve to the correct day and time.",
    "Natural dayparts now map to stable times: утром 10:00, в обед 13:00, вечером 17:00.",
    "Default CRM reminder prompts now include the same natural-date examples."
  ]
};
