export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.23",
  title: "Telegram new lead routing and undo restore",
  items: [
    "Telegram now treats natural phrases like next client, next potential lead, new client, and their Russian equivalents as a fresh lead start.",
    "The New Lead command clears the active Telegram draft/session before starting a new intake.",
    "Undo for Telegram draft-session updates now restores the lead display name along with the other lead fields."
  ]
};
