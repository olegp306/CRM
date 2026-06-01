import type { AssistantChannelResponse } from "./channel-message";

export type LeadSearchRecord = {
  id: string;
  leadId: string;
  createdDate: string | Date;
  status: string;
  temperature?: string | null;
  requestType?: string | null;
  projectAddress?: string | null;
  clientName?: string | null;
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

  return {
    kind: "leads",
    wantsCsv,
    filters: {
      datePreset,
      ...(temperature ? { temperature } : {}),
      ...(status ? { status } : {})
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

function formatLeadSearchLine(record: LeadSearchRecord): string {
  return [
    record.leadId,
    record.clientName,
    record.temperature,
    record.status,
    record.requestType,
    record.projectAddress
  ]
    .filter(Boolean)
    .join(" · ");
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
