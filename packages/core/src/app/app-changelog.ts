export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.27",
  title: "Telegram undo voice and table ownership polish",
  items: [
    "Telegram undo replies now start with the fixed base line `undo successful and logged`, followed by an optional personalized phrase from AI Intake settings.",
    "Lead table Client and Auto badges now explain linked-table fields and automatically calculated values on hover.",
    "Shared editable tables now support the same linked-field and auto-field ownership hints for future CRM tables.",
    "The mobile web assistant launcher is smaller so it covers less of the working area."
  ]
};
