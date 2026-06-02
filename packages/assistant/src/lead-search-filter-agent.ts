import type { AssistantChannelResponse } from "./channel-message";
import type { AssistantSubmissionInput, AssistantSubmissionResult } from "./submission";
import { createAssistantSubmissionResultFromChannelResponse } from "./submission";
import { createAssistantMessageDraft, createAssistantThreadDraft } from "./thread-message";

export type LeadSearchRecord = {
  id: string;
  leadId: string;
  createdDate: string | Date;
  status: string;
  temperature?: string | null;
  requestType?: string | null;
  projectAddress?: string | null;
  clientName?: string | null;
  displayName?: string | null;
  searchTags?: string[] | null;
};

export type LeadSearchDatePreset = "last_month" | "current_month" | null;

export type LeadSearchFilterRequest = {
  kind: "leads";
  wantsCsv: boolean;
  filters: {
    datePreset: LeadSearchDatePreset;
    temperature?: "hot" | "warm" | "cold";
    status?: string;
    query?: string;
  };
};

export function parseLeadSearchFilterRequest(
  content: string,
  options: { now?: Date } = {}
): LeadSearchFilterRequest {
  const text = content.toLowerCase();
  const wantsCsv = /\b(csv|excel|xlsx|spreadsheet|export)\b/i.test(content) || /(csv|excel|экспорт|скачай|скинь)/i.test(content);
  const datePreset = detectDatePreset(text);
  const temperature = detectTemperature(text);
  const status = detectStatus(text);
  const query = detectSearchQuery(content, { hasStructuredFilters: Boolean(datePreset || temperature || status) });

  return {
    kind: "leads",
    wantsCsv,
    filters: {
      datePreset,
      ...(temperature ? { temperature } : {}),
      ...(status ? { status } : {}),
      ...(query ? { query } : {})
    }
  };
}

export function filterLeadSearchRecords(
  records: LeadSearchRecord[],
  request: LeadSearchFilterRequest,
  options: { now?: Date } = {}
): LeadSearchRecord[] {
  const now = options.now ?? new Date();
  const range = createDateRange(request.filters.datePreset, now);

  return records
    .filter((record) => {
      const createdAt = new Date(record.createdDate);

      if (range && (createdAt < range.from || createdAt >= range.to)) {
        return false;
      }

      if (request.filters.temperature && record.temperature !== request.filters.temperature) {
        return false;
      }

      if (request.filters.status && record.status !== request.filters.status) {
        return false;
      }

      if (request.filters.query && !doesLeadMatchQuery(record, request.filters.query)) {
        return false;
      }

      return true;
    })
    .sort((left, right) => new Date(right.createdDate).getTime() - new Date(left.createdDate).getTime());
}

export function createLeadSearchFilterResponse(
  content: string,
  records: LeadSearchRecord[],
  options: { now?: Date; limit?: number } = {}
): AssistantChannelResponse {
  const request = parseLeadSearchFilterRequest(content, options);
  const matches = filterLeadSearchRecords(records, request, options);
  const limit = options.limit ?? 5;
  const shown = matches.slice(0, limit);
  const lines = shown.map(formatLeadSearchLine);
  const extraCount = Math.max(matches.length - shown.length, 0);
  const text =
    matches.length === 0
      ? "No leads matched this filter."
      : [`Found ${matches.length} leads.`, ...lines, ...(extraCount > 0 ? [`...and ${extraCount} more.`] : [])].join("\n");

  return {
    intent: "support_request",
    shouldPersistFeedback: false,
    feedbackType: undefined,
    normalizedActions: [],
    buttons: request.wantsCsv ? [{ label: "Download CSV", action: "download_csv", url: createLeadCsvUrl(request) }] : [],
    text
  };
}

export function createLeadSearchFilterSubmissionResult(
  input: AssistantSubmissionInput,
  records: LeadSearchRecord[],
  options: { now?: Date; limit?: number } = {}
): AssistantSubmissionResult {
  const trimmedContent = input.content.trim();
  const thread = createAssistantThreadDraft({
    context: input.context,
    title: trimmedContent
  });
  const message = createAssistantMessageDraft({
    threadId: input.threadId,
    userId: input.context.userId,
    role: "user",
    content: trimmedContent,
    context: input.context
  });

  return createAssistantSubmissionResultFromChannelResponse({
    thread,
    message,
    channelResponse: createLeadSearchFilterResponse(trimmedContent, records, options),
    context: input.context,
    threadId: input.threadId,
    messageId: input.messageId,
    attachments: input.attachments ?? []
  });
}

function formatLeadSearchLine(record: LeadSearchRecord): string {
  return [
    record.leadId,
    record.displayName,
    record.clientName,
    record.temperature,
    record.status,
    record.requestType,
    record.projectAddress
  ]
    .filter(Boolean)
    .join(" · ");
}

function doesLeadMatchQuery(record: LeadSearchRecord, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  const haystack = [
    record.leadId,
    record.displayName,
    record.clientName,
    record.temperature,
    record.status,
    record.requestType,
    record.projectAddress,
    ...(record.searchTags ?? [])
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalizeSearchText);

  return haystack.some((value) => value.includes(normalizedQuery));
}

function createLeadCsvUrl(request: LeadSearchFilterRequest): string {
  const params = new URLSearchParams();

  if (request.filters.datePreset) {
    params.set("date", request.filters.datePreset);
  }

  if (request.filters.temperature) {
    params.set("temperature", request.filters.temperature);
  }

  if (request.filters.status) {
    params.set("status", request.filters.status);
  }

  const query = params.toString();
  return `/exports/leads${query ? `?${query}` : ""}`;
}

function detectDatePreset(text: string): LeadSearchDatePreset {
  if (/\b(last|previous)\s+month\b/i.test(text) || /прошл[а-яё]*\s+месяц/i.test(text)) {
    return "last_month";
  }

  if (/\b(this|current)\s+month\b/i.test(text) || /текущ[а-яё]*\s+месяц|эт[а-яё]*\s+месяц/i.test(text)) {
    return "current_month";
  }

  return null;
}

function detectTemperature(text: string): "hot" | "warm" | "cold" | null {
  if (/\bhot\b|горяч/i.test(text)) {
    return "hot";
  }

  if (/\bwarm\b|тепл/i.test(text)) {
    return "warm";
  }

  if (/\bcold\b|холод/i.test(text)) {
    return "cold";
  }

  return null;
}

function detectStatus(text: string): string | null {
  if (/\bneeds[_\s-]?data\b|не\s+хватает\s+данн/i.test(text)) {
    return "needs_data";
  }

  if (/\bnew\b|нов/i.test(text)) {
    return "new";
  }

  return null;
}

function detectSearchQuery(content: string, options: { hasStructuredFilters: boolean }): string | null {
  const trimmed = content.trim();
  const explicit =
    /\b(?:find|search|show|list)\s+(?:leads?\s+)?(?:(tagged|with\s+tag|by\s+tag|for|about)\s+)?([A-Za-z0-9_ -]{3,80})/i.exec(trimmed) ??
    /(?:найди|покажи|найти|ищи)\s+(?:лид[а-яё]*\s+)?(?:(по\s+тегу|с\s+тегом|про)\s+)?([A-Za-zА-Яа-яЁё0-9_ -]{3,80})/i.exec(trimmed) ??
    null;

  if (!explicit) {
    return null;
  }

  const marker = explicit[1];
  if (options.hasStructuredFilters && !marker) {
    return null;
  }

  return explicit[2]
    .replace(/\b(?:leads?|tagged|with|tag|from|last|current|month|warm|hot|cold|new|needs data)\b/gi, "")
    .trim() || null;
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "_").trim();
}

function createDateRange(preset: LeadSearchDatePreset, now: Date): { from: Date; to: Date } | null {
  if (!preset) {
    return null;
  }

  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  if (preset === "current_month") {
    return {
      from: new Date(Date.UTC(year, month, 1)),
      to: new Date(Date.UTC(year, month + 1, 1))
    };
  }

  return {
    from: new Date(Date.UTC(year, month - 1, 1)),
    to: new Date(Date.UTC(year, month, 1))
  };
}
