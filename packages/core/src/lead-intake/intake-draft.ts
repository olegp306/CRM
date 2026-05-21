import { detectLeadMissingData, type LeadMissingField } from "../leads/missing-data";
import { classifyLeadStandardness } from "../leads/standard-classifier";

export type LeadIntakeSource = "web" | "telegram";

export type LeadIntakeDraftInput = {
  source: LeadIntakeSource;
  clientName?: string | null;
  email?: string | null;
  phone?: string | null;
  requestType?: string | null;
  projectAddress?: string | null;
  bgfM2?: string | number | null;
  rawInput?: string | null;
};

export type TelegramLeadIntakeInput = {
  fromName?: string | null;
  messageText: string;
  messageUrl?: string | null;
};

export type LeadIntakeDraft = {
  source: LeadIntakeSource;
  clientName: string | null;
  email: string | null;
  phone: string | null;
  requestType: string | null;
  projectAddress: string | null;
  bgfM2: number | null;
  rawInput: string;
  missingData: LeadMissingField[];
  isStandard: boolean;
};

export function createLeadIntakeDraft(input: LeadIntakeDraftInput): LeadIntakeDraft {
  const requestType = normalizeRequestType(input.requestType);
  const bgfM2 = normalizeNumber(input.bgfM2);
  const draft = {
    source: input.source,
    clientName: normalizeText(input.clientName),
    email: normalizeText(input.email),
    phone: normalizeText(input.phone),
    requestType,
    projectAddress: normalizeText(input.projectAddress),
    bgfM2,
    rawInput: normalizeText(input.rawInput) ?? ""
  };
  const missingData = detectLeadMissingData(draft);
  const standardness = classifyLeadStandardness({ requestType, bgfM2 });

  return {
    ...draft,
    missingData,
    isStandard: standardness.isStandard
  };
}

export function createTelegramLeadIntakeDraft(input: TelegramLeadIntakeInput): LeadIntakeDraft {
  const messageText = input.messageText.trim();
  const messageUrl = normalizeText(input.messageUrl);
  const rawInput = messageUrl ? `${messageText}\nTelegram: ${messageUrl}` : messageText;

  return createLeadIntakeDraft({
    source: "telegram",
    clientName: input.fromName,
    email: extractEmail(messageText),
    phone: extractPhone(messageText),
    requestType: inferRequestType(messageText),
    projectAddress: extractProjectAddress(messageText),
    bgfM2: extractBgfM2(messageText),
    rawInput
  });
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  const parsed = Number(text.replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRequestType(value: string | null | undefined): string | null {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  return inferRequestType(text) ?? text;
}

function inferRequestType(text: string): string | null {
  if (/\b(new build|new_build|neubau|efh)\b/i.test(text) || /новый\s+дом|ефх/i.test(text)) {
    return "new_build";
  }

  if (/\b(renovation|sanierung|umbau|altbau)\b/i.test(text) || /ремонт|реконструкц/i.test(text)) {
    return "renovation";
  }

  return null;
}

function extractEmail(text: string): string | null {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
}

function extractPhone(text: string): string | null {
  return text.match(/(?:\+|00)\d[\d\s().-]{6,}\d/)?.[0].replace(/\s+/g, " ").trim() ?? null;
}

function extractBgfM2(text: string): number | null {
  const match = text.match(/\b(?:bgf|brutto[-\s]?grundfl(?:a|ä)che)\D{0,10}(\d{2,4}(?:[,.]\d+)?)/i);
  return normalizeNumber(match?.[1]);
}

function extractProjectAddress(text: string): string | null {
  const withoutContacts = text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
    .replace(/(?:\+|00)\d[\d\s().-]{6,}\d/g, "");
  const parts = withoutContacts
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const address = parts.find((part) => /\d/.test(part) && !/\bbgf\b/i.test(part));

  return address ?? null;
}
