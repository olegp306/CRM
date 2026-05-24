export type LeadTableColumnKey =
  | "leadId"
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
  kpDocxAttachmentId?: string;
  kpPdfAttachmentId?: string;
};

export type LeadActionPlanItem = {
  title: string;
  dueDate: string;
  status: "due" | "planned" | "waiting" | "done";
  description: string;
};

export type LeadHistoryItem = {
  title: string;
  at: string;
  actor: "Telegram" | "CRM" | "Operator";
  stageLabel: string;
  description: string;
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

export const leadTableColumns: LeadTableColumn[] = [
  { key: "leadId", label: "Lead ID", enableSorting: true, defaultSize: 132 },
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

export function createLeadTableRows(
  records: LeadTableRecord[],
  generatedDocuments: LeadGeneratedDocumentReference[] = []
): LeadTableRow[] {
  const documentsById = new Map(generatedDocuments.map((document) => [document.documentId, document]));

  return records.map((record) => ({
    id: record.id,
    leadId: record.leadId,
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
    kpPdfAttachmentId: documentsById.get(record.kpGeneratedDocumentId ?? "")?.pdfAttachmentId ?? undefined
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
): LeadHistoryItem[] {
  const history: LeadHistoryItem[] = [
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
