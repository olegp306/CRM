export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.28",
  title: "LangGraph Telegram search and material attachment",
  items: [
    "Telegram LangGraph runtime can search leads, show the latest 6 records, and open found leads as Telegram cards for reply-based work.",
    "Forwarded WhatsApp, Mail, voice, image, PDF, or document material can be attached to an existing lead with captions such as `к лиду 009` or `to lead L-2026-009`.",
    "Explicit lead references are resolved before intake, so unresolved or ambiguous references ask for clarification instead of creating a new lead.",
    "Telegram help, the shared assistant capability message, and the default CRM Orchestrator prompt describe the new attach-to-lead workflow."
  ]
};
