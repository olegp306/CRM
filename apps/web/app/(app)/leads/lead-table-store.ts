export type LeadTableColumnKey =
  | "leadId"
  | "leadName"
  | "loopStage"
  | "clientRecordId"
  | "createdDate"
  | "temperature"
  | "requestType"
  | "urgency"
  | "budgetEur"
  | "desiredStart"
  | "desiredMoveIn"
  | "bgfM2"
  | "wohnflaecheM2"
  | "projectAddress"
  | "isStandard"
  | "status"
  | "source"
  | "rawInput"
  | "missingData"
  | "kpGeneratedDocumentId"
  | "kpSentDate"
  | "followup1Date"
  | "followupStatus"
  | "outcome"
  | "outcomeReason"
  | "projectRecordId";

export type LeadTableColumn = {
  key: LeadTableColumnKey;
  label: string;
  enableSorting: true;
  defaultSize: number;
  maxSize?: number;
};

export type LeadTableViewMode = "split" | "full" | "inline";

export type LeadMobileViewMode = "cards" | "table";

export type LeadTableRecord = {
  id: string;
  leadId: string;
  displayName?: string | null;
  clientRecordId: string | null;
  createdDate: Date | string | null;
  temperature: string | null;
  requestType: string | null;
  urgency: string | null;
  budgetEur: number | string | { toString(): string } | null;
  desiredStart: Date | string | null;
  desiredMoveIn: Date | string | null;
  bgfM2: number | string | { toString(): string } | null;
  wohnflaecheM2: number | string | { toString(): string } | null;
  projectAddress: string | null;
  isStandard: boolean | null;
  status: string;
  rawInput: string | null;
  missingData: unknown;
  kpGeneratedDocumentId: string | null;
  kpSentDate: Date | string | null;
  followup1Date: Date | string | null;
  followupStatus: string | null;
  outcome: string | null;
  outcomeReason: string | null;
  projectRecordId: string | null;
  contextEntities?: LeadContextEntityRecord[];
  calendarActions?: LeadCalendarActionRecord[];
};

export type LeadCalendarActionRecord = {
  id: string;
  title: string;
  description?: string | null;
  dueAt?: Date | string | null;
  recurrence?: string | null;
  status?: string | null;
  sourceChannel?: string | null;
  sourceMessageId?: string | null;
  actorUserId?: string | null;
  createdAt?: Date | string | null;
};

export type LeadContextEntityRecord = {
  entityType: string;
  label: string;
  value: string;
  confidence: string;
  normalizedKey?: string | null;
};

export type LeadTableRow = Record<LeadTableColumnKey, string> & {
  id: string;
  kpDocxAttachmentId?: string;
  kpPdfAttachmentId?: string;
  channelEvents?: LeadChannelHistoryEvent[];
  contextEntities?: LeadContextItem[];
  calendarActions?: LeadCalendarActionRecord[];
};

export type LeadActionPlanItem = {
  title: string;
  dueDate: string;
  status: "due" | "planned" | "waiting" | "done";
  description: string;
};

export type LeadCalendarItem = {
  id: string;
  title: string;
  date: string;
  status: string;
  description: string;
  kind: "followup" | "reminder" | "birthday" | "event";
  recurrence: string | null;
  badgeLabel: string;
  badgeTone: "amber" | "blue" | "emerald" | "rose" | "neutral";
  sourceLabel: string;
  leadId?: string;
  leadName?: string;
};

export type LeadCalendarDay = {
  date: string;
  day: number;
  isCurrentMonth: boolean;
  itemCount: number;
  items: LeadCalendarItem[];
};

export type LeadCalendarViewModel = {
  nextSummary: string;
  initialMonth: string;
  items: LeadCalendarItem[];
};

export type LeadCalendarMonthViewModel = {
  month: string;
  monthLabel: string;
  weeks: LeadCalendarDay[][];
};

export type LeadHistoryItem = {
  title: string;
  at: string;
  actor: "Telegram" | "CRM" | "Operator";
  stageLabel: string;
  description: string;
};

export type LeadContextItem = {
  type: string;
  label: string;
  value: string;
  confidence: string;
  normalizedKey: string | null;
};

export type LeadContextPanelItem = {
  title: string;
  description: string;
  meta: string;
};

export type LeadChannelHistoryEvent = {
  createdAt: Date | string;
  metadata: unknown;
};

export type LeadLoopStepMode = "manual" | "automatic" | "branch";

export type LeadLoopStepStatus = "implemented" | "partial" | "gap";

export type LeadLoopTimelineStep = {
  id: number;
  title: string;
  description: string;
  mode: LeadLoopStepMode;
  status: LeadLoopStepStatus;
  isCurrent: boolean;
  progressState: "done" | "current" | "upcoming";
};

export type LeadLoopTimelineViewModel = {
  currentStepId: number;
  steps: LeadLoopTimelineStep[];
};

export type LeadSourceReference = {
  label: string;
  url: string | null;
};

export type LeadSummaryInfoItem = {
  title: string;
  kind: "message" | "photo" | "pdf" | "audio" | "summary";
  description: string;
  fullText?: string;
  url: string | null;
};

export const leadTableColumns: LeadTableColumn[] = [
  { key: "leadId", label: "Lead ID", enableSorting: true, defaultSize: 132 },
  { key: "leadName", label: "Lead name", enableSorting: true, defaultSize: 240, maxSize: 420 },
  { key: "loopStage", label: "Loop stage", enableSorting: true, defaultSize: 132 },
  { key: "clientRecordId", label: "Client ID", enableSorting: true, defaultSize: 160 },
  { key: "createdDate", label: "Created", enableSorting: true, defaultSize: 124 },
  { key: "temperature", label: "Temperature", enableSorting: true, defaultSize: 132 },
  { key: "requestType", label: "Request type", enableSorting: true, defaultSize: 152 },
  { key: "urgency", label: "Urgency", enableSorting: true, defaultSize: 120 },
  { key: "budgetEur", label: "Budget EUR", enableSorting: true, defaultSize: 132 },
  { key: "desiredStart", label: "Desired start", enableSorting: true, defaultSize: 144 },
  { key: "desiredMoveIn", label: "Desired move-in", enableSorting: true, defaultSize: 152 },
  { key: "bgfM2", label: "BGF m2", enableSorting: true, defaultSize: 112 },
  { key: "wohnflaecheM2", label: "Wohnfläche m2", enableSorting: true, defaultSize: 152 },
  { key: "projectAddress", label: "Project address", enableSorting: true, defaultSize: 220 },
  { key: "isStandard", label: "Standard", enableSorting: true, defaultSize: 116 },
  { key: "status", label: "Status", enableSorting: true, defaultSize: 128 },
  { key: "source", label: "Source", enableSorting: true, defaultSize: 116 },
  { key: "rawInput", label: "Raw input", enableSorting: true, defaultSize: 220, maxSize: 480 },
  { key: "missingData", label: "Missing data", enableSorting: true, defaultSize: 180, maxSize: 360 },
  { key: "kpGeneratedDocumentId", label: "KP document", enableSorting: true, defaultSize: 168 },
  { key: "kpSentDate", label: "KP sent", enableSorting: true, defaultSize: 124 },
  { key: "followup1Date", label: "Follow-up date", enableSorting: true, defaultSize: 152 },
  { key: "followupStatus", label: "Follow-up status", enableSorting: true, defaultSize: 160 },
  { key: "outcome", label: "Outcome", enableSorting: true, defaultSize: 132 },
  { key: "outcomeReason", label: "Outcome reason", enableSorting: true, defaultSize: 200, maxSize: 360 },
  { key: "projectRecordId", label: "Project ID", enableSorting: true, defaultSize: 160 }
];

export const leadTableViewModes: Array<{ id: LeadTableViewMode; label: string; description: string }> = [
  { id: "split", label: "Split", description: "Table with selected lead side panel." },
  { id: "full", label: "Full", description: "Full-width table with popup editor." },
  { id: "inline", label: "Inline", description: "Quick-edit safe fields directly in the table." }
];

export const leadTableViewModeStorageKey = "crm.table.leads.view-mode.v1";

export function normalizeLeadTableViewMode(input: unknown): LeadTableViewMode {
  return leadTableViewModes.some((mode) => mode.id === input) ? (input as LeadTableViewMode) : "split";
}

export function resolveInitialSelectedLeadId(_viewMode: LeadTableViewMode, _leadIds: string[]): string | null {
  return null;
}

export function resolveDeepLinkedLeadRowId(rows: Array<Pick<LeadTableRow, "id" | "leadId">>, leadId: string | null): string | null {
  if (!leadId) {
    return null;
  }

  return rows.find((row) => row.leadId === leadId || row.id === leadId)?.id ?? null;
}

export const leadMobileViewModes: Array<{ id: LeadMobileViewMode; label: string; description: string }> = [
  { id: "cards", label: "Cards", description: "Mobile cards with the most important lead fields." },
  { id: "table", label: "Table", description: "Full horizontal lead table on mobile." }
];

export const leadMobileCardFields: LeadTableColumnKey[] = ["createdDate", "status", "requestType", "projectAddress", "source"];

export const inlineEditableLeadFields: LeadTableColumnKey[] = [
  "temperature",
  "requestType",
  "urgency",
  "budgetEur",
  "status",
  "projectAddress",
  "followupStatus",
  "outcome"
];

export function isInlineEditableLeadField(key: LeadTableColumnKey): boolean {
  return inlineEditableLeadFields.includes(key);
}

export function clampLeadColumnSizing(columnSizing: Record<string, number>): Record<string, number> {
  const maxSizes = new Map<string, number>(
    leadTableColumns
      .filter((column) => column.maxSize)
      .map((column) => [column.key, column.maxSize as number])
  );

  return Object.fromEntries(
    Object.entries(columnSizing).map(([key, size]) => {
      const maxSize = maxSizes.get(key);
      return [key, maxSize ? Math.min(size, maxSize) : size];
    })
  );
}

export function getLeadSourceMaterials(rawInput: string): { references: LeadSourceReference[]; sourceText: string } {
  const sourceText = rawInput.trim();
  if (!sourceText) {
    return { references: [], sourceText: "" };
  }

  const references = sourceText
    .split(/\r?\n/)
    .flatMap((line) => createLeadSourceReferenceEntries(line.trim()))
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(createLeadSourceReference);

  return { references, sourceText };
}

export function createLeadSummaryInfo(rawInput: string): LeadSummaryInfoItem[] {
  const sourceText = rawInput.trim();
  if (!sourceText) {
    return [];
  }

  const lines = sourceText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const transcriptByNumber = createAudioTranscriptMap(lines);
  const materialAnalysis = parseLeadMaterialAnalysis(lines);
  const items: LeadSummaryInfoItem[] = [];
  const leadSummary = materialAnalysis.leadSummary ?? findLegacyLeadSummary(lines);

  if (leadSummary) {
    items.push(createLeadSummaryInfoItem("Lead summary", "summary", leadSummary, null));
  }

  const sourceMessage = createLeadSourceMessage(lines);
  if (sourceMessage) {
    items.push(createLeadSummaryInfoItem("Message", "message", sourceMessage, null));
  }

  for (const line of lines) {
    if (/^Telegram sources?:/i.test(line)) {
      continue;
    }

    const attachment = parseTelegramAttachmentSummaryLine(line);
    if (attachment) {
      const analyzedDescription = materialAnalysis.documentSummaryByFileName.get(attachment.fileName.toLowerCase());
      items.push(
        createLeadSummaryInfoItem(
          attachment.fileName,
          attachment.kind,
          analyzedDescription ?? createAttachmentDescription(attachment, transcriptByNumber.get(attachment.number)),
          attachment.savedAttachmentId ? `/documents/attachments/${encodeURIComponent(attachment.savedAttachmentId)}` : null
        )
      );
      continue;
    }
  }

  return items;
}

function createLeadSummaryInfoItem(
  title: string,
  kind: LeadSummaryInfoItem["kind"],
  fullText: string,
  url: string | null
): LeadSummaryInfoItem {
  return {
    title,
    kind,
    description: truncateLeadSummaryDescription(fullText),
    fullText,
    url
  };
}

function findLegacyLeadSummary(lines: string[]): string | null {
  const leadSummary = lines.map((line) => /^Lead summary:\s*(.+)$/i.exec(line)?.[1]?.trim()).find(Boolean);
  if (leadSummary) {
    return leadSummary;
  }

  return lines.map((line) => /^Summary:\s*(.+)$/i.exec(line)?.[1]?.trim()).find(Boolean) ?? null;
}

function createLeadSourceMessage(lines: string[]): string | null {
  const messageLines: string[] = [];
  let isSourceMaterialSummaryBlock = false;
  let isAudioTranscriptBody = false;

  for (const line of lines) {
    if (/^Source material summaries:\s*$/i.test(line)) {
      isSourceMaterialSummaryBlock = true;
      continue;
    }

    if (isSourceMaterialSummaryBlock) {
      if (/^-\s+/.test(line)) {
        continue;
      }
      isSourceMaterialSummaryBlock = false;
    }

    if (/^Audio transcript \d+/i.test(line)) {
      isAudioTranscriptBody = true;
      continue;
    }

    if (isAudioTranscriptBody) {
      isAudioTranscriptBody = false;
      if (!isLeadSummaryControlLine(line)) {
        continue;
      }
    }

    if (isLeadSummaryControlLine(line)) {
      continue;
    }

    messageLines.push(line);
  }

  return messageLines.join("\n").trim() || null;
}

function parseLeadMaterialAnalysis(lines: string[]): {
  leadSummary: string | null;
  documentSummaryByFileName: Map<string, string>;
} {
  const documentSummaryByFileName = new Map<string, string>();
  let isDocumentSummaryBlock = false;
  let leadSummary: string | null = null;

  for (const line of lines) {
    const summary = /^Lead summary:\s*(.+)$/i.exec(line)?.[1]?.trim();
    if (summary) {
      leadSummary = summary;
      isDocumentSummaryBlock = false;
      continue;
    }

    if (/^Source material summaries:\s*$/i.test(line)) {
      isDocumentSummaryBlock = true;
      continue;
    }

    if (isDocumentSummaryBlock) {
      const documentSummary = /^-\s*([^:]+):\s*(.+)$/i.exec(line);
      if (documentSummary) {
        documentSummaryByFileName.set(documentSummary[1].trim().toLowerCase(), stripTranscriptFromMaterialSummary(documentSummary[2].trim()));
        continue;
      }

      if (isLeadSummaryControlLine(line)) {
        isDocumentSummaryBlock = false;
      }
    }
  }

  return { leadSummary, documentSummaryByFileName };
}

function stripTranscriptFromMaterialSummary(summary: string): string {
  return summary.replace(/\s+Transcript:\s+.*$/i, "").trim();
}

function createAudioTranscriptMap(lines: string[]): Map<number, string> {
  const transcripts = new Map<number, string>();

  lines.forEach((line, index) => {
    const match = /^Audio transcript (\d+)(?:\s*\([^)]+\))?:\s*(.*)$/i.exec(line);
    if (!match) {
      return;
    }

    const number = Number(match[1]);
    const inlineTranscript = match[2]?.trim();
    const nextLine = lines[index + 1]?.trim();
    transcripts.set(number, inlineTranscript || (nextLine && !isLeadSummaryControlLine(nextLine) ? nextLine : ""));
  });

  return transcripts;
}

function isLeadSummaryControlLine(line: string): boolean {
  return /^(Telegram sources?:|Telegram attachment \d+:|\[Telegram .+ attachment:|Audio transcript \d+|Summary:|Lead summary:|Source material summaries:|Suggested reply:)/i.test(line);
}

function parseTelegramAttachmentSummaryLine(line: string): {
  number: number;
  kind: "photo" | "pdf" | "audio";
  fileName: string;
  savedAttachmentId: string | null;
} | null {
  const normalizedLine = line.replace(/^\[(.*)\]$/, "$1");
  const match = /^Telegram attachment (\d+):\s*(photo|audio|pdf)\s*\((.*)\)$/i.exec(normalizedLine);
  if (!match) {
    return null;
  }

  const kind = match[2].toLowerCase() as "photo" | "pdf" | "audio";
  const details = match[3].trim();
  const savedAttachmentId = /(?:^|,\s*)saved\s+([^,\s)]+)/i.exec(details)?.[1] ?? null;
  const fileName = details.split(",")[0]?.trim() || `telegram-${kind}`;

  return {
    number: Number(match[1]),
    kind,
    fileName,
    savedAttachmentId
  };
}

function createAttachmentDescription(
  attachment: { kind: "photo" | "pdf" | "audio"; fileName: string },
  transcript: string | undefined
): string {
  if (attachment.kind === "audio") {
    return truncateLeadSummaryDescription(transcript?.trim() || `Audio message from Telegram: ${attachment.fileName}.`);
  }

  if (attachment.kind === "pdf") {
    return `PDF file from Telegram: ${attachment.fileName}.`;
  }

  return `Photo file from Telegram: ${attachment.fileName}.`;
}

function truncateLeadSummaryDescription(description: string): string {
  return description.length > 150 ? `${description.slice(0, 147).trimEnd().replace(/\.+$/u, "")}...` : description;
}

function createLeadSourceReferenceEntries(line: string): string[] {
  if (/^Telegram sources?:/i.test(line)) {
    return line.replace(/^Telegram sources?:/i, "").split(",");
  }

  if (/^Telegram attachment \d+:/i.test(line) || /^\[Telegram .+ attachment:/i.test(line)) {
    return [line.replace(/^\[(.*)\]$/, "$1")];
  }

  return [];
}

function createLeadSourceReference(reference: string): LeadSourceReference {
  if (/^https?:\/\//i.test(reference)) {
    return { label: reference, url: reference };
  }

  const telegramMatch = /^telegram:(-?\d+):(\d+)$/i.exec(reference);
  if (!telegramMatch) {
    return { label: reference, url: null };
  }

  const [, chatId, messageId] = telegramMatch;
  const publicChatPath = chatId.startsWith("-100") ? chatId.slice(4) : chatId.startsWith("-") ? chatId.slice(1) : chatId;
  return {
    label: reference,
    url: publicChatPath ? `https://t.me/c/${publicChatPath}/${messageId}` : null
  };
}

export type LeadGeneratedDocumentReference = {
  documentId: string;
  docxAttachmentId: string | null;
  pdfAttachmentId: string | null;
};

export type LeadChannelEventsByLeadId = Record<string, LeadChannelHistoryEvent[]>;

export function createLeadTableRows(
  records: LeadTableRecord[],
  generatedDocuments: LeadGeneratedDocumentReference[] = [],
  channelEventsByLeadId: LeadChannelEventsByLeadId = {}
): LeadTableRow[] {
  const documentsById = new Map(generatedDocuments.map((document) => [document.documentId, document]));

  return records.map((record) => ({
    id: record.id,
    leadId: record.leadId,
    leadName: record.displayName ?? record.leadId,
    loopStage: formatLeadLoopStage(record),
    clientRecordId: record.clientRecordId ?? "",
    createdDate: formatDate(record.createdDate),
    temperature: record.temperature ?? "",
    requestType: record.requestType ?? "",
    urgency: record.urgency ?? "",
    budgetEur: formatScalar(record.budgetEur),
    desiredStart: formatDate(record.desiredStart),
    desiredMoveIn: formatDate(record.desiredMoveIn),
    bgfM2: formatScalar(record.bgfM2),
    wohnflaecheM2: formatScalar(record.wohnflaecheM2),
    projectAddress: record.projectAddress ?? "",
    isStandard: formatBoolean(record.isStandard),
    status: record.status,
    source: formatLeadSource(record.rawInput),
    rawInput: record.rawInput ?? "",
    missingData: formatMissingData(record.missingData),
    kpGeneratedDocumentId: record.kpGeneratedDocumentId ?? "",
    kpSentDate: formatDate(record.kpSentDate),
    followup1Date: formatDate(record.followup1Date),
    followupStatus: record.followupStatus ?? "",
    outcome: record.outcome ?? "",
    outcomeReason: record.outcomeReason ?? "",
    projectRecordId: record.projectRecordId ?? "",
    kpDocxAttachmentId: documentsById.get(record.kpGeneratedDocumentId ?? "")?.docxAttachmentId ?? undefined,
    kpPdfAttachmentId: documentsById.get(record.kpGeneratedDocumentId ?? "")?.pdfAttachmentId ?? undefined,
    channelEvents: channelEventsByLeadId[record.leadId] ?? undefined,
    contextEntities: createLeadContextItemsFromRecords(record.contextEntities ?? []),
    calendarActions: record.calendarActions ?? []
  }));
}

export type LeadUrlSearchFilters = {
  leadSearch: string | null;
  temperature: string | null;
  status: string | null;
  date: string | null;
  now?: Date;
};

export function filterLeadRowsForUrlSearch(rows: LeadTableRow[], filters: LeadUrlSearchFilters): LeadTableRow[] {
  const normalizedQuery = normalizeLeadUrlSearchText(filters.leadSearch ?? "");
  const temperature = (filters.temperature ?? "").trim().toLowerCase();
  const status = (filters.status ?? "").trim().toLowerCase();
  const dateRange = createLeadUrlDateRange(filters.date, filters.now ?? new Date());

  if (!normalizedQuery && !temperature && !status && !dateRange) {
    return rows;
  }

  return rows.filter((row) => {
    if (normalizedQuery && !createLeadRowSearchText(row).includes(normalizedQuery)) {
      return false;
    }

    if (temperature && row.temperature.toLowerCase() !== temperature) {
      return false;
    }

    if (status && row.status.toLowerCase() !== status) {
      return false;
    }

    if (dateRange) {
      const created = new Date(`${row.createdDate}T00:00:00.000Z`);
      if (Number.isNaN(created.getTime()) || created < dateRange.from || created >= dateRange.to) {
        return false;
      }
    }

    return true;
  });
}

function createLeadRowSearchText(row: LeadTableRow): string {
  return normalizeLeadUrlSearchText(
    [
      row.leadId,
      row.leadName,
      row.clientRecordId,
      row.temperature,
      row.requestType,
      row.urgency,
      row.projectAddress,
      row.status,
      row.rawInput,
      row.missingData,
      ...(row.contextEntities ?? []).flatMap((entity) => [entity.label, entity.value, entity.normalizedKey ?? ""])
    ].join(" ")
  );
}

function normalizeLeadUrlSearchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "_").trim();
}

function createLeadUrlDateRange(datePreset: string | null, now: Date): { from: Date; to: Date } | null {
  if (datePreset !== "current_month" && datePreset !== "last_month") {
    return null;
  }

  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  if (datePreset === "current_month") {
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

export function createLeadContextItems(lead: Pick<LeadTableRow, "contextEntities">): LeadContextPanelItem[] {
  return (lead.contextEntities ?? []).map((entity) => ({
    title: entity.label,
    description: entity.value,
    meta: [entity.type, entity.confidence, entity.normalizedKey].filter(Boolean).join(" · ")
  }));
}

function createLeadContextItemsFromRecords(records: LeadContextEntityRecord[]): LeadContextItem[] | undefined {
  const items = records
    .map((record) => ({
      type: record.entityType,
      label: record.label,
      value: record.value,
      confidence: record.confidence,
      normalizedKey: record.normalizedKey ?? null
    }))
    .filter((item) => item.label.trim().length > 0 || item.value.trim().length > 0);

  return items.length > 0 ? items : undefined;
}

export function createLeadActionPlan(lead: Pick<LeadTableRow, "missingData" | "isStandard" | "kpGeneratedDocumentId" | "kpSentDate" | "followup1Date" | "outcome" | "projectRecordId">): LeadActionPlanItem[] {
  const plan: LeadActionPlanItem[] = [];

  if (lead.missingData) {
    plan.push({
      title: "Complete missing data",
      dueDate: "Now",
      status: "due",
      description: `Resolve: ${lead.missingData}`
    });
  }

  if (lead.isStandard === "yes" && !lead.kpGeneratedDocumentId) {
    plan.push({
      title: "Generate KP",
      dueDate: "After data check",
      status: "planned",
      description: "Standard lead can use price table and KP template."
    });
  }

  if (!lead.kpSentDate && lead.kpGeneratedDocumentId) {
    plan.push({
      title: "Send KP",
      dueDate: "After review",
      status: "planned",
      description: "Review the generated offer and mark it as sent."
    });
  }

  if (lead.followup1Date) {
    plan.push({
      title: "Follow up",
      dueDate: lead.followup1Date,
      status: "planned",
      description: "Check client reaction and update outcome."
    });
  }

  if (!lead.outcome) {
    plan.push({
      title: "Capture outcome",
      dueDate: "After response",
      status: "waiting",
      description: "Mark won, lost, thinking, or archive with reason."
    });
  }

  if (lead.outcome === "contract" && !lead.projectRecordId) {
    plan.push({
      title: "Create project",
      dueDate: "After signed contract",
      status: "planned",
      description: "Convert this lead into a project operations workspace."
    });
  }

  return plan;
}

export function createLeadCalendarViewModel(
  lead: Pick<LeadTableRow, "followup1Date" | "followupStatus" | "outcome"> &
    Partial<Pick<LeadTableRow, "leadId" | "leadName" | "calendarActions">>,
  options: { today?: Date } = {}
): LeadCalendarViewModel {
  const items = createLeadCalendarItems(lead).sort((left, right) => left.date.localeCompare(right.date));
  const today = formatDate(options.today ?? new Date());
  const nextItem = items.find((item) => item.date >= today) ?? items[0];
  const initialMonth = nextItem ? nextItem.date.slice(0, 7) : today.slice(0, 7);

  return {
    nextSummary: nextItem
      ? `Next: ${nextItem.date} - ${nextItem.title}${nextItem.description ? `: ${nextItem.description}` : ""}`
      : "No scheduled future actions yet.",
    initialMonth,
    items
  };
}

export function createLeadCalendarItems(
  lead: Pick<LeadTableRow, "followup1Date" | "followupStatus" | "outcome"> &
    Partial<Pick<LeadTableRow, "leadId" | "leadName" | "calendarActions">>
): LeadCalendarItem[] {
  const actionItems = (lead.calendarActions ?? [])
    .map((action) => createLeadCalendarItemFromAction(action, lead))
    .filter((item): item is LeadCalendarItem => Boolean(item));
  const followupDate = normalizeCalendarDate(lead.followup1Date);
  const hasExistingFollowup = followupDate
    ? actionItems.some((item) => item.date === followupDate && item.kind === "followup")
    : false;

  if (followupDate && !lead.outcome && !hasExistingFollowup) {
    actionItems.push({
      id: `followup-${lead.leadId ?? "lead"}-${followupDate}`,
      title: "Follow up",
      date: followupDate,
      status: lead.followupStatus || "planned",
      description: "Check client reaction and update outcome.",
      kind: "followup",
      recurrence: null,
      badgeLabel: "Follow-up",
      badgeTone: "amber",
      sourceLabel: "Lead follow-up",
      leadId: lead.leadId,
      leadName: lead.leadName
    });
  }

  return actionItems;
}

export function createLeadCalendarMonthViewModel(month: string, items: LeadCalendarItem[]): LeadCalendarMonthViewModel {
  const normalizedMonth = normalizeCalendarMonth(month) ?? formatDate(new Date()).slice(0, 7);
  const monthDate = new Date(`${normalizedMonth}-01T00:00:00.000Z`);

  return {
    month: normalizedMonth,
    monthLabel: formatCalendarMonthLabel(monthDate),
    weeks: createCalendarWeeks(monthDate, items)
  };
}

export function shiftLeadCalendarMonth(month: string, offset: number): string {
  const normalizedMonth = normalizeCalendarMonth(month) ?? formatDate(new Date()).slice(0, 7);
  const date = new Date(`${normalizedMonth}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export function createLeadHistory(
  lead: Pick<
    LeadTableRow,
    | "leadId"
    | "createdDate"
    | "source"
    | "temperature"
    | "requestType"
    | "projectAddress"
    | "bgfM2"
    | "budgetEur"
    | "isStandard"
    | "missingData"
    | "kpGeneratedDocumentId"
    | "kpSentDate"
    | "followup1Date"
    | "followupStatus"
    | "outcome"
    | "projectRecordId"
  >
  & { channelEvents?: LeadChannelHistoryEvent[] }
): LeadHistoryItem[] {
  const channelHistory = createLeadChannelHistory(lead.channelEvents ?? [], lead.leadId);
  const history: LeadHistoryItem[] = [
    ...channelHistory,
    {
      title: "Lead created",
      at: lead.createdDate || "Unknown date",
      actor: lead.source === "telegram" ? "Telegram" : "Operator",
      stageLabel: "Step 4",
      description: `${lead.leadId} was created from ${lead.source || "web"} intake.`
    }
  ];

  const importedFields = [
    ["temperature", lead.temperature],
    ["requestType", lead.requestType],
    ["projectAddress", lead.projectAddress],
    ["bgfM2", lead.bgfM2],
    ["budgetEur", lead.budgetEur],
    ["isStandard", lead.isStandard],
    ["missingData", lead.missingData]
  ]
    .filter(([, value]) => value.trim().length > 0)
    .map(([name]) => name);

  history.push({
    title: "Fields imported",
    at: lead.createdDate || "Unknown date",
    actor: lead.source === "telegram" ? "Telegram" : "Operator",
    stageLabel: "Steps 2-4",
    description:
      importedFields.length > 0
        ? `Captured ${importedFields.join(", ")}.`
        : "No commercial proposal fields have been captured yet."
  });

  history.push({
    title: "Automatic checks",
    at: lead.createdDate || "Unknown date",
    actor: "CRM",
    stageLabel: "Step 5",
    description: createLeadAutomaticCheckDescription(lead)
  });

  if (lead.kpGeneratedDocumentId) {
    history.push({
      title: "KP generated",
      at: lead.createdDate || "Unknown date",
      actor: "CRM",
      stageLabel: "Step 6",
      description: `Commercial proposal record ${lead.kpGeneratedDocumentId} is available.`
    });
  }

  if (lead.kpGeneratedDocumentId && !lead.kpSentDate) {
    history.push({
      title: "Undo to KP review",
      at: "Current state",
      actor: "Operator",
      stageLabel: "Step 5",
      description: "The lead is back before KP sent; review the proposal before marking it sent again."
    });
  }

  if (lead.kpSentDate) {
    history.push({
      title: "KP sent",
      at: lead.kpSentDate,
      actor: "Operator",
      stageLabel: "Step 7",
      description: "Commercial proposal was marked as sent to the client."
    });
  }

  if (lead.followup1Date) {
    history.push({
      title: "Follow-up scheduled",
      at: lead.followup1Date,
      actor: "CRM",
      stageLabel: "Step 8",
      description: `Follow-up is scheduled${lead.followupStatus ? ` with status ${lead.followupStatus}` : ""}.`
    });
  }

  if (lead.outcome || lead.projectRecordId) {
    history.push({
      title: "Outcome captured",
      at: "Current state",
      actor: "Operator",
      stageLabel: "Step 9",
      description: lead.projectRecordId ? `Converted toward project ${lead.projectRecordId}.` : `Outcome: ${lead.outcome}.`
    });
  }

  return history;
}

function createLeadChannelHistory(events: LeadChannelHistoryEvent[], leadId: string): LeadHistoryItem[] {
  return events
    .flatMap((event) => createLeadChannelHistoryItem(event, leadId))
    .sort((left, right) => left.sortTime - right.sortTime)
    .map(({ sortTime: _sortTime, ...item }) => item);
}

function createLeadChannelHistoryItem(event: LeadChannelHistoryEvent, leadId: string): Array<LeadHistoryItem & { sortTime: number }> {
  const metadata = event.metadata;
  if (!metadata || typeof metadata !== "object") {
    return [];
  }

  const channelEvent = metadata as Record<string, unknown>;
  if (channelEvent.leadId !== leadId) {
    return [];
  }

  const actor = channelEvent.channel === "telegram" ? "Telegram" : channelEvent.channel === "web" ? "Operator" : "CRM";
  const at = formatDateTime(event.createdAt);
  const sortTime = getTime(event.createdAt);

  switch (channelEvent.type) {
    case "lead_created": {
      const fields = Array.isArray(channelEvent.fieldsCreated) ? channelEvent.fieldsCreated.join(", ") : "lead fields";
      return [
        {
          title: "Lead created",
          at,
          actor,
          stageLabel: "Step 4",
          description: `${actor} created lead ${leadId} with ${fields}.`,
          sortTime
        }
      ];
    }
    case "lead_draft_updated": {
      const fields = Array.isArray(channelEvent.fieldsChanged) ? channelEvent.fieldsChanged.join(", ") : "lead fields";
      return [
        {
          title: "Lead updated",
          at,
          actor,
          stageLabel: "Steps 2-4",
          description: `${actor} updated ${fields}.`,
          sortTime
        }
      ];
    }
    case "lead_interaction_note":
      return [
        {
          title: channelEvent.channel === "telegram" ? "Telegram note" : "Assistant note",
          at,
          actor,
          stageLabel: "Interaction",
          description: `Request: add note. Action: note saved. ${String(channelEvent.summary ?? "")}`.trim(),
          sortTime
        }
      ];
    case "lead_match_detected": {
      const matchedFields = Array.isArray(channelEvent.matchedFields)
        ? channelEvent.matchedFields.filter((field): field is string => typeof field === "string")
        : [];
      const matchType = String(channelEvent.matchType ?? "");
      const title =
        matchType === "duplicate" ? "Duplicate blocked" : matchType === "likely_update" ? "Existing lead match" : "Needs clarification";
      const description =
        matchType === "duplicate"
          ? `${actor} blocked a duplicate lead creation.`
          : `${actor} found a possible existing lead match by ${matchedFields.length > 0 ? matchedFields.join(", ") : "lead data"}.`;

      return [
        {
          title,
          at,
          actor,
          stageLabel: "Duplicate check",
          description,
          sortTime
        }
      ];
    }
    case "kp_generated":
      return [
        {
          title: "KP generated",
          at,
          actor,
          stageLabel: "Step 6",
          description: `${actor} generated commercial proposal ${String(channelEvent.documentId ?? "")}.`,
          sortTime
        }
      ];
    case "kp_sent_marked":
      return [
        {
          title: "KP sent",
          at,
          actor,
          stageLabel: "Step 7",
          description: `${actor} marked the commercial proposal as sent.`,
          sortTime
        }
      ];
    case "kp_sent_undone":
      return [
        {
          title: "Undo to KP review",
          at,
          actor,
          stageLabel: "Step 5",
          description: `${actor} moved the lead back before KP sent.`,
          sortTime
        }
      ];
    default:
      return [];
  }
}

export function createLeadKpMailtoHref(
  lead: Pick<LeadTableRow, "leadId" | "rawInput"> & Pick<Partial<LeadTableRow>, "kpPdfAttachmentId" | "kpDocxAttachmentId">,
  origin: string
): string | null {
  const pdfUrl = lead.kpPdfAttachmentId ? createAbsoluteAttachmentUrl(origin, lead.kpPdfAttachmentId) : "";
  const docxUrl = lead.kpDocxAttachmentId ? createAbsoluteAttachmentUrl(origin, lead.kpDocxAttachmentId) : "";

  if (!pdfUrl && !docxUrl) {
    return null;
  }

  const recipient = extractEmailFromLeadText(lead.rawInput);
  const subject = `KP ${lead.leadId}`;
  const body = [
    "Hallo,",
    "",
    "anbei finden Sie den Link zum vorbereiteten kommerziellen Angebot.",
    pdfUrl ? `PDF: ${pdfUrl}` : "",
    docxUrl ? `DOCX: ${docxUrl}` : "",
    "",
    "Viele Gruesse"
  ]
    .filter(Boolean)
    .join("\n");

  return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function createKpDownloadBaseName(
  lead: Pick<LeadTableRow, "leadId" | "createdDate" | "rawInput">
): string {
  const initials = extractLeadInitials(lead.rawInput);
  const createdDate = lead.createdDate.trim() || new Date().toISOString().slice(0, 10);
  return sanitizeFileName([initials, "KP", lead.leadId, createdDate].filter(Boolean).join("-"));
}

function createAbsoluteAttachmentUrl(origin: string, attachmentId: string): string {
  return `${origin.replace(/\/+$/, "")}/documents/attachments/${encodeURIComponent(attachmentId)}`;
}

function extractEmailFromLeadText(text: string): string {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(text)?.[0] ?? "";
}

function extractLeadInitials(text: string): string {
  const explicitClient = /(?:client|name)\s*[:=-]\s*([^\n,;]+)/i.exec(text)?.[1]?.trim();
  const source = explicitClient || text;
  const words = Array.from(source.matchAll(/\p{L}+/gu))
    .map((match) => match[0])
    .filter((word) => !isIgnoredInitialWord(word));
  const initials = words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "LEAD";
}

function isIgnoredInitialWord(word: string): boolean {
  return new Set(["client", "name", "lead", "telegram", "need", "hello", "hallo"]).has(word.toLowerCase());
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^\w.\- ]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function createLeadAutomaticCheckDescription(
  lead: Pick<LeadTableRow, "missingData" | "isStandard" | "kpGeneratedDocumentId" | "kpSentDate">
): string {
  if (lead.missingData) {
    return `Missing commercial proposal data: ${lead.missingData}.`;
  }

  if (lead.isStandard === "yes") {
    return "Standard pricing branch is available.";
  }

  if (lead.isStandard === "no") {
    return "Custom pricing branch is required.";
  }

  if (lead.kpGeneratedDocumentId && !lead.kpSentDate) {
    return "KP is generated and waiting for manual review before sending.";
  }

  return "CRM checked the lead and is waiting for the next workflow signal.";
}

export function canMarkLeadKpSent(lead: Pick<LeadTableRow, "kpGeneratedDocumentId" | "kpSentDate">): boolean {
  return lead.kpGeneratedDocumentId.trim().length > 0 && lead.kpSentDate.trim().length === 0;
}

export function canUndoLeadKpSent(lead: Pick<LeadTableRow, "kpGeneratedDocumentId" | "kpSentDate">): boolean {
  return lead.kpGeneratedDocumentId.trim().length > 0 && lead.kpSentDate.trim().length > 0;
}

export const leadLoopTimelineSteps: Array<Omit<LeadLoopTimelineStep, "isCurrent" | "progressState">> = [
  {
    id: 1,
    title: "Send raw Telegram material",
    description: "Operator sends text, photos, or PDF material that describes the potential project.",
    mode: "manual",
    status: "implemented"
  },
  {
    id: 2,
    title: "AI extracts lead fields",
    description: "Telegram intake parses client, request, address, BGF, contacts, and source material.",
    mode: "automatic",
    status: "partial"
  },
  {
    id: 3,
    title: "Ask for missing data",
    description: "The bot keeps a draft and asks for fields required for a commercial proposal.",
    mode: "automatic",
    status: "implemented"
  },
  {
    id: 4,
    title: "Create client and lead",
    description: "CRM creates the lead record and links the source material for later review.",
    mode: "automatic",
    status: "partial"
  },
  {
    id: 5,
    title: "Standard vs custom branch",
    description: "CRM classifies whether standard pricing can be used or manual pricing is needed.",
    mode: "branch",
    status: "partial"
  },
  {
    id: 6,
    title: "Review and send KP",
    description: "A generated KP is ready for review; PDF and DOCX can be downloaded from the card.",
    mode: "manual",
    status: "partial"
  },
  {
    id: 7,
    title: "Mark KP sent",
    description: "Operator confirms that the commercial proposal was sent to the client.",
    mode: "manual",
    status: "partial"
  },
  {
    id: 8,
    title: "Schedule follow-up",
    description: "CRM stores the first follow-up date after the KP was sent.",
    mode: "automatic",
    status: "partial"
  },
  {
    id: 9,
    title: "Reminder and follow-up draft",
    description: "CRM surfaces due follow-ups and prepares the next client message.",
    mode: "automatic",
    status: "partial"
  }
];

export function createLeadLoopTimelineViewModel(
  lead: Pick<
    LeadTableRow,
    "missingData" | "isStandard" | "kpGeneratedDocumentId" | "kpSentDate" | "followup1Date" | "outcome" | "projectRecordId"
  > | null
): LeadLoopTimelineViewModel {
  const currentStepId = resolveCurrentLeadLoopStepId(lead);

  return {
    currentStepId,
    steps: leadLoopTimelineSteps.map((step) => ({
      ...step,
      isCurrent: step.id === currentStepId,
      progressState: step.id < currentStepId ? "done" : step.id === currentStepId ? "current" : "upcoming"
    }))
  };
}

function resolveCurrentLeadLoopStepId(
  lead: Pick<
    LeadTableRow,
    "missingData" | "isStandard" | "kpGeneratedDocumentId" | "kpSentDate" | "followup1Date" | "outcome" | "projectRecordId"
  > | null
): number {
  if (!lead) {
    return 5;
  }

  if (lead.outcome || lead.projectRecordId) {
    return 9;
  }

  if (lead.followup1Date && lead.kpSentDate) {
    return 8;
  }

  if (lead.kpGeneratedDocumentId && !lead.kpSentDate) {
    return 5;
  }

  if (lead.missingData) {
    return 3;
  }

  if (lead.isStandard === "yes" || lead.isStandard === "no") {
    return 5;
  }

  return 4;
}

function formatLeadLoopStage(record: LeadTableRecord): string {
  const row = {
    missingData: formatMissingData(record.missingData),
    isStandard: formatBoolean(record.isStandard),
    kpGeneratedDocumentId: record.kpGeneratedDocumentId ?? "",
    kpSentDate: formatDate(record.kpSentDate),
    followup1Date: formatDate(record.followup1Date),
    outcome: record.outcome ?? "",
    projectRecordId: record.projectRecordId ?? ""
  };
  const stageId = resolveCurrentLeadLoopStepId(row);
  const title = leadLoopTimelineSteps.find((step) => step.id === stageId)?.title ?? "Unknown";

  return `${stageId}. ${title}`;
}

function normalizeCalendarDate(value: Date | string | null): string | null {
  const formatted = formatDate(value);
  return formatted || null;
}

function normalizeCalendarMonth(value: string): string | null {
  if (/^\d{4}-\d{2}$/.test(value)) {
    return value;
  }
  const date = new Date(`${value}-01T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 7);
}

function createLeadCalendarItemFromAction(
  action: LeadCalendarActionRecord,
  lead: Partial<Pick<LeadTableRow, "leadId" | "leadName">>
): LeadCalendarItem | null {
  const date = normalizeCalendarDate(action.dueAt ?? null);
  if (!date) {
    return null;
  }

  const kind = classifyLeadCalendarKind(action);
  const recurrence = action.recurrence?.trim() || null;
  const badge = createLeadCalendarBadge(kind, recurrence);

  return {
    id: action.id,
    title: action.title || "Calendar action",
    date,
    status: action.status || "planned",
    description: action.description || "No description yet.",
    kind,
    recurrence,
    badgeLabel: badge.label,
    badgeTone: badge.tone,
    sourceLabel: action.sourceChannel || "CRM",
    leadId: lead.leadId,
    leadName: lead.leadName
  };
}

function classifyLeadCalendarKind(action: LeadCalendarActionRecord): LeadCalendarItem["kind"] {
  const text = `${action.title} ${action.description ?? ""} ${action.recurrence ?? ""}`.toLowerCase();
  if (/birthday|birth day|день рождения|др\b|geburtstag/.test(text)) {
    return "birthday";
  }
  if (/follow[- ]?up|followup|перезвон|созвон|написать|позвонить|уточнить|проверить|ping|пинг/.test(text)) {
    return "followup";
  }
  if (/remind|reminder|напом|follow/.test(text)) {
    return "reminder";
  }
  return "event";
}

function createLeadCalendarBadge(
  kind: LeadCalendarItem["kind"],
  recurrence: string | null
): { label: string; tone: LeadCalendarItem["badgeTone"] } {
  if (kind === "birthday") {
    return { label: recurrence === "yearly" ? "DR yearly" : "DR", tone: "rose" };
  }
  if (recurrence === "yearly") {
    return { label: "Yearly", tone: "emerald" };
  }
  if (kind === "followup") {
    return { label: "Follow-up", tone: "amber" };
  }
  if (kind === "reminder") {
    return { label: "Reminder", tone: "blue" };
  }
  return { label: "Event", tone: "neutral" };
}

function formatCalendarMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function createCalendarWeeks(monthDate: Date, items: LeadCalendarItem[]): LeadCalendarDay[][] {
  const firstOfMonth = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 1));
  const lastOfMonth = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0));
  const startOffset = (firstOfMonth.getUTCDay() + 6) % 7;
  const start = new Date(firstOfMonth);
  start.setUTCDate(firstOfMonth.getUTCDate() - startOffset);
  const endOffset = (7 - ((lastOfMonth.getUTCDay() + 6) % 7) - 1) % 7;
  const end = new Date(lastOfMonth);
  end.setUTCDate(lastOfMonth.getUTCDate() + endOffset);
  const itemsByDate = new Map<string, LeadCalendarItem[]>();
  for (const item of items) {
    itemsByDate.set(item.date, [...(itemsByDate.get(item.date) ?? []), item]);
  }

  const days: LeadCalendarDay[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    days.push({
      date,
      day: cursor.getUTCDate(),
      isCurrentMonth: cursor.getUTCMonth() === monthDate.getUTCMonth(),
      itemCount: itemsByDate.get(date)?.length ?? 0,
      items: itemsByDate.get(date) ?? []
    });
  }

  const weeks: LeadCalendarDay[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return weeks;
}

function formatDate(value: Date | string | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function getTime(value: Date | string): number {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatScalar(value: number | string | { toString(): string } | null): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : value.toString();
}

function formatBoolean(value: boolean | null): string {
  if (value === null) return "";
  return value ? "yes" : "no";
}

function formatLeadSource(rawInput: string | null): string {
  if (!rawInput) return "web";
  return /Telegram sources?: telegram:|^Telegram:/i.test(rawInput) ? "telegram" : "web";
}

function formatMissingData(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(String).join(", ");
  }

  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, entry]) => `${key}: ${String(entry)}`)
      .join(", ");
  }

  return "";
}
