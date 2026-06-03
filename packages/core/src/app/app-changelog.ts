export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.12",
  title: "Generalized reminder date prompts",
  items: [
    "Default CRM reminder prompts now explain the general rule for через N дней instead of only listing fixed examples.",
    "The prompt tells the model to accept day counts written as digits or Russian words.",
    "Ambiguous phrases like через несколько дней now ask one short clarification instead of being treated as missing a date.",
    "The same natural-date rule is included in the CRM entity extraction prompt."
  ]
};
