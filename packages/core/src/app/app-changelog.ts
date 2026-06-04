export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.20",
  title: "Telegram contact reply hotfix",
  items: [
    "Telegram reply updates no longer query email or phone as Lead fields, which prevents the Server Error seen on test.",
    "Phone, email, and client-name updates from Telegram replies are saved through the linked Client record.",
    "If a lead has no Client yet, Telegram contact updates create and attach one automatically."
  ]
};
