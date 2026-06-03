export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.14",
  title: "Manual Telegram lead renaming",
  items: [
    "Telegram replies like 'измени название на ...' now update the lead display name as its own field.",
    "Manual lead renames no longer overwrite request type or project address with parser guesses like rename project.",
    "Undo snapshots now keep the previous lead display name for Telegram update rollbacks."
  ]
};
