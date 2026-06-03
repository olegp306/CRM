export type AppChangelogEntry = {
  version: string;
  title: string;
  items: string[];
};

export const currentAppChangelog: AppChangelogEntry = {
  version: "0.4.10",
  title: "Telegram reply context hotfix",
  items: [
    "Telegram reply context lookup no longer requests non-existent Lead email/phone fields from Prisma.",
    "Reply-based lead updates can resolve the target lead card without returning Server Error.",
    "Reply-based reminders and history notes can resolve the target lead card through client contact data.",
    "A regression test now covers the Telegram reply lookup query shape."
  ]
};
