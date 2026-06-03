export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.3",
  title: "CRM entity extraction and Telegram undo",
  items: [
    "CRM entity extraction now saves lead facts, tags, people, organizations, follow-ups, and calendar actions from Telegram and web assistant messages.",
    "Lead cards show localized lead names, action calendar context, extracted CRM context, and material summaries for cleaner review.",
    "Telegram search understands human phrases for project titles, tags, locations, and recent lead lists, then returns readable CRM buttons.",
    "Settings lead reset clears lead context entities and calendar actions before deleting test leads.",
    "Telegram lead create/update replies include Undo; update undo can restore the lead and offer creating a separate lead from the same source."
  ]
};
