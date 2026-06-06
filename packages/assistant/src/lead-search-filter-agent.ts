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
  email?: string | null;
  phone?: string | null;
  displayName?: string | null;
  searchTags?: string[] | null;
  rawInput?: string | null;
  summary?: string | null;
  bgfM2?: number | string | null;
  budgetEur?: number | string | null;
  desiredStart?: string | null;
  desiredMoveIn?: string | null;
  urgency?: string | null;
  source?: string | null;
  messenger?: string | null;
  communicationChannel?: string | null;
  missingData?: string[] | null;
};

export type LeadSearchDatePreset = "last_month" | "current_month" | null;

export type LeadSearchFilterRequest = {
  kind: "leads";
  wantsCsv: boolean;
  limit?: number;
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
  const limit = detectResultLimit(content);
  const query = detectSearchQuery(content, { hasStructuredFilters: Boolean(datePreset || temperature || status) });

  return {
    kind: "leads",
    wantsCsv,
    ...(limit ? { limit } : {}),
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
  const query = request.filters.query;

  const filtered = records.filter((record) => {
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

      if (query && !doesLeadMatchQuery(record, query)) {
        return false;
      }

      return true;
    });

  const recordsToRank =
    query && filtered.some((record) => getLeadSearchPrimaryScore(record, query) > 0)
      ? filtered.filter((record) => getLeadSearchPrimaryScore(record, query) > 0)
      : filtered;

  return recordsToRank.sort((left, right) => {
    if (query) {
      const scoreDelta = getLeadSearchScore(right, query) - getLeadSearchScore(left, query);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
    }

    return new Date(right.createdDate).getTime() - new Date(left.createdDate).getTime();
  });
}

export function createLeadSearchFilterResponse(
  content: string,
  records: LeadSearchRecord[],
  options: { now?: Date; limit?: number; includeCrmButtons?: boolean; telegramLeadButtons?: boolean } = {}
): AssistantChannelResponse {
  const request = parseLeadSearchFilterRequest(content, options);
  const matches = filterLeadSearchRecords(records, request, options);
  const limit = options.limit ?? request.limit ?? 5;
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
    buttons: createLeadSearchButtons(request, shown, {
      includeCrmButtons: options.includeCrmButtons,
      telegramLeadButtons: options.telegramLeadButtons,
      wantsCsv: request.wantsCsv,
      hasMatches: matches.length > 0
    }),
    text
  };
}

export function createLeadSearchCrmResultsUrl(request: LeadSearchFilterRequest): string {
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

  if (request.filters.query) {
    params.set("leadSearch", request.filters.query);
  }

  const query = params.toString();
  return `/leads${query ? `?${query}` : ""}`;
}

function createLeadSearchButtons(
  request: LeadSearchFilterRequest,
  shown: LeadSearchRecord[],
  options: { includeCrmButtons?: boolean; telegramLeadButtons?: boolean; wantsCsv: boolean; hasMatches: boolean }
): AssistantChannelResponse["buttons"] {
  const buttons: AssistantChannelResponse["buttons"] = [];

  if (options.includeCrmButtons) {
    buttons.push(
      ...shown.map((record) => ({
        label: options.telegramLeadButtons ? createLeadTelegramButtonLabel(record) : createLeadCrmButtonLabel(record),
        action: options.telegramLeadButtons ? ("open_lead" as const) : ("open_crm" as const),
        ...(options.telegramLeadButtons ? { value: record.leadId } : { url: `/leads?leadId=${encodeURIComponent(record.leadId)}` })
      }))
    );

    if (options.hasMatches) {
      buttons.push({
        label: "Open results in CRM",
        action: "open_crm",
        url: createLeadSearchCrmResultsUrl(request)
      });
    }
  }

  if (options.wantsCsv) {
    buttons.push({ label: "Download CSV", action: "download_csv", url: createLeadCsvUrl(request) });
  }

  return buttons;
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
  const clientName = record.clientName?.trim();
  const safeLeadId = escapeLeadSearchHtml(record.leadId);
  const details = [
    clientName ? `<b>${escapeLeadSearchHtml(clientName)}</b>` : null,
    record.displayName,
    record.requestType,
    record.projectAddress,
    record.temperature,
    record.status
  ]
    .filter(Boolean)
    .map((value) => (String(value).startsWith("<b>") ? String(value) : escapeLeadSearchHtml(String(value))))
    .join(" · ");
  const compactDetails = truncateSearchResultDetails(details);

  return compactDetails ? `${safeLeadId} · ${compactDetails}` : safeLeadId;
}

function doesLeadMatchQuery(record: LeadSearchRecord, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  const haystackValues = getLeadSearchValues(record).map(normalizeSearchText);
  const haystack = haystackValues.join("_");

  if (haystack.includes(normalizedQuery)) {
    return true;
  }

  const queryTokens = tokenizeSearchText(query);
  if (queryTokens.length === 0) {
    return false;
  }

  const matchedTokens = queryTokens.filter((token) => doesSearchTokenMatch(token, haystackValues));
  const requiredMatches = queryTokens.length === 1 ? 1 : Math.max(2, Math.ceil(queryTokens.length * 0.6));
  return matchedTokens.length >= requiredMatches;
}

function getLeadSearchScore(record: LeadSearchRecord, query: string): number {
  return getLeadSearchPrimaryScore(record, query) + getLeadSearchSecondaryScore(record, query);
}

function getLeadSearchPrimaryScore(record: LeadSearchRecord, query: string): number {
  return scoreSearchValues(getLeadSearchPrimaryValues(record), query, 10);
}

function getLeadSearchSecondaryScore(record: LeadSearchRecord, query: string): number {
  return scoreSearchValues(getLeadSearchSecondaryValues(record), query, 1);
}

function scoreSearchValues(values: Array<string | null | undefined>, query: string, weight: number): number {
  const normalizedValues = values.filter((value): value is string => Boolean(value)).map(normalizeSearchText);
  const normalizedQuery = normalizeSearchText(query);
  const tokens = tokenizeSearchText(query);
  const joined = normalizedValues.join("_");

  let score = 0;
  if (normalizedQuery && normalizedValues.some((value) => value === normalizedQuery)) {
    score += 100 * weight;
  }

  if (normalizedQuery && normalizedValues.some((value) => value.includes(normalizedQuery))) {
    score += 40 * weight;
  }

  for (const token of tokens) {
    if (doesSearchTokenMatch(token, normalizedValues)) {
      score += 8 * weight;
    }
  }

  if (tokens.length > 1 && tokens.every((token) => joined.includes(normalizeSearchText(token)))) {
    score += 20 * weight;
  }

  return score;
}

function getLeadSearchValues(record: LeadSearchRecord): string[] {
  return [...getLeadSearchPrimaryValues(record), ...getLeadSearchSecondaryValues(record)].filter((value): value is string => Boolean(value));
}

function getLeadSearchPrimaryValues(record: LeadSearchRecord): Array<string | null | undefined> {
  return [
    record.leadId,
    record.displayName,
    record.clientName,
    record.temperature,
    record.status,
    record.requestType,
    record.projectAddress,
    record.email,
    record.phone,
    record.bgfM2 === undefined || record.bgfM2 === null ? null : String(record.bgfM2),
    record.budgetEur === undefined || record.budgetEur === null ? null : String(record.budgetEur),
    record.desiredStart,
    record.desiredMoveIn,
    record.urgency,
    record.source,
    record.messenger,
    record.communicationChannel,
    ...(record.missingData ?? []),
    ...(record.searchTags ?? [])
  ];
}

function getLeadSearchSecondaryValues(record: LeadSearchRecord): Array<string | null | undefined> {
  return [record.rawInput, record.summary];
}

function createLeadCrmButtonLabel(record: LeadSearchRecord): string {
  const title = (record.displayName || record.clientName || record.requestType || record.projectAddress || "").trim();
  if (!title) {
    return `CRM ${record.leadId}`;
  }

  return `${record.leadId} · ${truncateButtonTitle(title)}`;
}

function createLeadTelegramButtonLabel(record: LeadSearchRecord): string {
  const title = (record.displayName || record.clientName || record.requestType || record.projectAddress || record.leadId).trim();
  return truncateButtonTitle(title);
}

function truncateSearchResultDetails(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 160) {
    return normalized;
  }

  return `${normalized.slice(0, 157).trimEnd()}...`;
}

function truncateButtonTitle(title: string): string {
  if (title.length <= 32) {
    return title;
  }

  const head = title.slice(0, 29).trimEnd();
  const lastSpace = head.lastIndexOf(" ");
  const trimmedHead = lastSpace >= 20 ? head.slice(0, lastSpace) : head;
  return `${trimmedHead.trimEnd()}...`;
}

function escapeLeadSearchHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function doesSearchTokenMatch(token: string, haystackValues: string[]): boolean {
  if (token.length <= 1) {
    return false;
  }

  return haystackValues.some((value) => value.includes(token) || token.includes(value));
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
  if (isLatestListRequest(trimmed)) {
    return null;
  }

  const email = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.exec(trimmed)?.[0];
  if (email && /\b(find|search|show|open|look up|pull up|get)\b|(?:РЅР°Р№РґРё|РїРѕРєР°Р¶Рё|РёС‰Рё|РѕС‚РєСЂРѕР№)/i.test(trimmed)) {
    return email;
  }

  const phone = /\+?\d[\d\s().-]{6,}\d/.exec(trimmed)?.[0]?.trim();
  if (phone && /\b(phone|tel|telephone|number|contact|client|lead)\b|(?:С‚РµР»РµС„РѕРЅ|РЅРѕРјРµСЂ|РєРѕРЅС‚Р°РєС‚|РєР»РёРµРЅС‚|Р»РёРґ)/i.test(trimmed)) {
    return phone;
  }

  const explicit =
    /\b(?:find|search|show|list|open|pull\s+up)\s+(?:leads?|projects?|clients?\s+)?(?:(tagged|with\s+tag|by\s+tag|for|about|named|by\s+name|by\s+title)\s+)?([\p{L}0-9_ -]{2,80})/iu.exec(trimmed) ??
    /(?:найди|покажи|найти|ищи|открой)\s+(?:лид[а-яё]*|проект[а-яё]*|клиент[а-яё]*)?\s*(?:(по\s+тегу|с\s+тегом|про|по\s+названию|по\s+имени)\s+)?([A-Za-zА-Яа-яЁё0-9_ -]{2,80})/i.exec(trimmed) ??
    null;

  if (!explicit) {
    return null;
  }

  const marker = explicit[1];
  if (options.hasStructuredFilters && !marker) {
    return null;
  }

  return explicit[2]
    .replace(/\b(?:leads?|projects?|clients?|tagged|with|tag|from|last|current|month|warm|hot|cold|new|needs data)\b/gi, "")
    .replace(/(?:лид[а-яё]*|проект[а-яё]*|клиент[а-яё]*|по\s+названию|по\s+имени|по\s+тегу|с\s+тегом)/gi, "")
    .trim() || null;
}

function detectResultLimit(content: string): number | null {
  const match =
    /\b(?:latest|last|recent|top)\s+(\d{1,2})\b/i.exec(content) ??
    /\b(\d{1,2})\s+(?:latest|last|recent)\b/i.exec(content) ??
    /(?:\u043f\u043e\u0441\u043b\u0435\u0434\u043d[\p{L}\p{N}_-]*|\u0441\u0432\u0435\u0436[\p{L}\p{N}_-]*)\s+(\d{1,2})/iu.exec(content) ??
    /(\d{1,2})\s+(?:\u043f\u043e\u0441\u043b\u0435\u0434\u043d[\p{L}\p{N}_-]*|\u0441\u0432\u0435\u0436[\p{L}\p{N}_-]*)/iu.exec(content);

  if (!match) {
    return null;
  }

  const limit = Number(match[1]);
  return Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 10) : null;
}

function isLatestListRequest(content: string): boolean {
  return (
    /\b(?:latest|last|recent|top)\s+\d{1,2}\b/i.test(content) ||
    /(?:\u043f\u043e\u0441\u043b\u0435\u0434\u043d[\p{L}\p{N}_-]*|\u0441\u0432\u0435\u0436[\p{L}\p{N}_-]*)\s+\d{1,2}/iu.test(content)
  );
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .trim();
}

function tokenizeSearchText(value: string): string[] {
  return normalizeSearchText(value)
    .split("_")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !isSearchStopWord(token));
}

function isSearchStopWord(token: string): boolean {
  return new Set([
    "find",
    "search",
    "show",
    "list",
    "lead",
    "leads",
    "client",
    "clients",
    "project",
    "projects",
    "by",
    "for",
    "about",
    "the",
    "a",
    "an"
  ]).has(token);
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
