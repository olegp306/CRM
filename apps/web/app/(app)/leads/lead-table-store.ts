export type LeadTableColumnKey =
  | "leadId"
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
};

export type LeadTableRow = Record<LeadTableColumnKey, string> & {
  id: string;
};

export type LeadActionPlanItem = {
  title: string;
  dueDate: string;
  status: "due" | "planned" | "waiting" | "done";
  description: string;
};

export type LeadSourceReference = {
  label: string;
  url: string | null;
};

export const leadTableColumns: LeadTableColumn[] = [
  { key: "leadId", label: "Lead ID", enableSorting: true, defaultSize: 132 },
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

export function createLeadTableRows(records: LeadTableRecord[]): LeadTableRow[] {
  return records.map((record) => ({
    id: record.id,
    leadId: record.leadId,
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
    projectRecordId: record.projectRecordId ?? ""
  }));
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

export function canMarkLeadKpSent(lead: Pick<LeadTableRow, "kpGeneratedDocumentId" | "kpSentDate">): boolean {
  return lead.kpGeneratedDocumentId.trim().length > 0 && lead.kpSentDate.trim().length === 0;
}

function formatDate(value: Date | string | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
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
