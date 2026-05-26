import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadRootEnv } from "../env/root-env";
import { sendTelegramMessage } from "./telegram-polling";

export type TelegramReleaseNotesInput = {
  version: string;
  notes: string[];
};

export type SendTelegramReleaseNotesInput = TelegramReleaseNotesInput & {
  botToken: string;
  chatIds: string[];
  crmBaseUrl?: string;
  confirm: boolean;
  fetchImpl?: typeof fetch;
};

export type TelegramReleaseNotesResult = {
  mode: "preview" | "sent";
  chatIds: string[];
  sent: number;
  message: string;
};

const MAX_NOTES = 3;
const MAX_NOTE_LENGTH = 120;

export function createTelegramReleaseNotesMessage(input: TelegramReleaseNotesInput): string {
  const version = input.version.trim();
  const notes = input.notes.map(normalizeReleaseNote).filter(Boolean).slice(0, MAX_NOTES);
  const lines = [`CRM updated to v${version}`, "", "What is new:"];

  if (notes.length === 0) {
    lines.push("- Small stability and workflow improvements.");
  } else {
    lines.push(...notes.map((note) => `- ${note}`));
  }

  lines.push("", "Open CRM when convenient. I can explain details if you ask.");

  return lines.join("\n");
}

export async function sendTelegramReleaseNotes(input: SendTelegramReleaseNotesInput): Promise<TelegramReleaseNotesResult> {
  const chatIds = normalizeChatIds(input.chatIds);
  const message = createTelegramReleaseNotesMessage(input);

  if (!input.confirm) {
    return {
      mode: "preview",
      chatIds,
      sent: 0,
      message
    };
  }

  for (const chatId of chatIds) {
    await sendTelegramMessage({
      botToken: input.botToken,
      chatId,
      text: message,
      disableNotification: true,
      replyMarkup: input.crmBaseUrl
        ? {
            inline_keyboard: [[{ text: "CRM", url: input.crmBaseUrl }]]
          }
        : undefined,
      fetchImpl: input.fetchImpl
    });
  }

  return {
    mode: "sent",
    chatIds,
    sent: chatIds.length,
    message
  };
}

export function parseTelegramReleaseNotesCliArgs(argv: string[]): {
  version: string;
  notes: string[];
  notesFile?: string;
  confirm: boolean;
} {
  const notes: string[] = [];
  let version = "";
  let notesFile: string | undefined;
  let confirm = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--confirm") {
      confirm = true;
    } else if (arg === "--version" && next) {
      version = next;
      index += 1;
    } else if (arg === "--note" && next) {
      notes.push(next);
      index += 1;
    } else if (arg === "--notes-file" && next) {
      notesFile = next;
      index += 1;
    }
  }

  return { version, notes, notesFile, confirm };
}

export async function runTelegramReleaseNotesCli(argv = process.argv.slice(2), env = process.env): Promise<TelegramReleaseNotesResult> {
  loadRootEnv();
  const args = parseTelegramReleaseNotesCliArgs(argv);
  const version = args.version || env.npm_package_version || "";
  const notes = [...args.notes, ...readReleaseNotesFile(args.notesFile)];
  const botToken = env.TELEGRAM_BOT_TOKEN ?? "";
  const chatIds = parseChatIds(env.TELEGRAM_RELEASE_NOTES_CHAT_IDS || env.TELEGRAM_ALLOWED_CHAT_IDS || "");
  const crmBaseUrl = env.TELEGRAM_CRM_BASE_URL || env.NEXT_PUBLIC_APP_URL;

  if (!version) {
    throw new Error("Pass --version or run through pnpm so npm_package_version is available.");
  }

  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is required.");
  }

  if (chatIds.length === 0) {
    throw new Error("Set TELEGRAM_RELEASE_NOTES_CHAT_IDS or TELEGRAM_ALLOWED_CHAT_IDS.");
  }

  const result = await sendTelegramReleaseNotes({
    botToken,
    chatIds,
    crmBaseUrl,
    version,
    notes,
    confirm: args.confirm
  });

  printReleaseNotesResult(result);
  return result;
}

function normalizeReleaseNote(note: string): string {
  const trimmed = note.trim().replace(/^[-*]\s*/, "");
  return trimmed.length > MAX_NOTE_LENGTH ? `${trimmed.slice(0, MAX_NOTE_LENGTH - 1).trim()}...` : trimmed;
}

function normalizeChatIds(chatIds: string[]): string[] {
  return Array.from(new Set(chatIds.map((chatId) => chatId.trim()).filter(Boolean)));
}

function parseChatIds(value: string): string[] {
  return normalizeChatIds(value.split(","));
}

function readReleaseNotesFile(notesFile: string | undefined): string[] {
  if (!notesFile) {
    return [];
  }

  const text = readFileSync(resolve(notesFile), "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, ""));
}

function printReleaseNotesResult(result: TelegramReleaseNotesResult): void {
  const target = result.chatIds.length === 1 ? "1 chat" : `${result.chatIds.length} chats`;
  const modeLine =
    result.mode === "preview"
      ? `Preview only for ${target}. Add --confirm to send quietly.`
      : `Sent quietly to ${target}.`;

  console.log(modeLine);
  console.log("");
  console.log(result.message);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runTelegramReleaseNotesCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
