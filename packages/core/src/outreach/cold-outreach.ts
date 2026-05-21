export type ColdTargetImportRow = {
  targetId?: string;
  clientId?: string;
  companyName: string;
  website?: string;
  region?: string;
  address?: string;
  contactPerson?: string;
  contactRole?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  fitScore?: number;
  priority?: string;
  notesResearch?: string;
};

export type ColdTargetImportWarning = {
  rowNumber: number;
  field: string;
  message: string;
};

export type ColdTargetImportPreview = {
  rows: ColdTargetImportRow[];
  warnings: ColdTargetImportWarning[];
};

export type OutreachTouchStatus = "pending" | "prepared" | "sent" | "skipped";
export type OutreachTouchChannel = "email" | "linkedin" | "call";
export type ColdTargetOutcome = "interested" | "not_interested" | "no_response" | "needs_review";

export type OutreachCadenceTouch = {
  touchNumber: number;
  channel: OutreachTouchChannel;
  scheduledAt: Date;
  status: OutreachTouchStatus;
};

export type ColdTargetLike = {
  id: string;
  workspaceId: string;
  companyName: string;
  website?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  notesResearch?: string;
  currentTouch?: number;
};

const CSV_HEADER_MAP: Record<string, keyof ColdTargetImportRow> = {
  target_id: "targetId",
  targetid: "targetId",
  client_id: "clientId",
  clientid: "clientId",
  company: "companyName",
  company_name: "companyName",
  companyname: "companyName",
  website: "website",
  region: "region",
  address: "address",
  contact_person: "contactPerson",
  contactperson: "contactPerson",
  contact_role: "contactRole",
  contactrole: "contactRole",
  email: "email",
  phone: "phone",
  linkedin: "linkedinUrl",
  linkedin_url: "linkedinUrl",
  linkedinurl: "linkedinUrl",
  fit_score: "fitScore",
  fitscore: "fitScore",
  priority: "priority",
  notes_research: "notesResearch",
  notesresearch: "notesResearch",
  notes: "notesResearch"
};

const CADENCE: Array<{ offsetDays: number; channel: OutreachTouchChannel }> = [
  { offsetDays: 0, channel: "email" },
  { offsetDays: 3, channel: "linkedin" },
  { offsetDays: 7, channel: "call" },
  { offsetDays: 14, channel: "email" },
  { offsetDays: 21, channel: "linkedin" },
  { offsetDays: 28, channel: "call" },
  { offsetDays: 35, channel: "email" },
  { offsetDays: 42, channel: "linkedin" }
];

export function parseColdTargetCsv(csv: string): ColdTargetImportPreview {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], warnings: [] };
  }

  const headers = splitDelimitedLine(lines[0]!).map((header) => CSV_HEADER_MAP[normalizeHeader(header)] ?? null);
  const rows: ColdTargetImportRow[] = [];
  const warnings: ColdTargetImportWarning[] = [];
  const seenKeys = new Set<string>();

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const values = splitDelimitedLine(lines[lineIndex]!);
    const row: ColdTargetImportRow = { companyName: "" };

    headers.forEach((field, index) => {
      if (!field) {
        return;
      }

      const value = values[index]?.trim();
      if (!value) {
        return;
      }

      if (field === "fitScore") {
        row[field] = Number(value);
        return;
      }

      row[field] = value;
    });

    rows.push(row);

    const rowNumber = lineIndex + 1;
    if (!row.companyName) {
      warnings.push({ rowNumber, field: "companyName", message: "Company name is required." });
    }

    const duplicateKey = createDuplicateKey(row);
    if (duplicateKey && seenKeys.has(duplicateKey)) {
      warnings.push({ rowNumber, field: "duplicate", message: "Duplicate cold target by company/website/email." });
    }
    if (duplicateKey) {
      seenKeys.add(duplicateKey);
    }
  }

  return { rows, warnings };
}

export function createOutreachCadence(startDate: Date): OutreachCadenceTouch[] {
  return CADENCE.map((touch, index) => ({
    touchNumber: index + 1,
    channel: touch.channel,
    scheduledAt: addDays(startDate, touch.offsetDays),
    status: "pending"
  }));
}

export function generatePersonaHook(notesResearch: string): string {
  const sentence = notesResearch
    .split(/[.!?]/)[0]
    ?.trim()
    .replace(/^builds\s+/i, "");
  if (!sentence) {
    return "Reference their current development focus and ask a concise discovery question.";
  }

  return `Reference their focus on ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}.`;
}

export function markOutreachTouchSent(
  target: ColdTargetLike,
  cadence: OutreachCadenceTouch[],
  touchNumber: number,
  sentAt: Date
) {
  const sentTouch = cadence.find((touch) => touch.touchNumber === touchNumber);

  if (!sentTouch) {
    throw new Error(`Outreach touch ${touchNumber} was not found.`);
  }

  const nextTouch = cadence.find((touch) => touch.touchNumber > touchNumber && touch.status !== "sent");

  return {
    sentTouch: {
      ...sentTouch,
      status: "sent" as const,
      sentAt
    },
    targetUpdate: {
      ...target,
      currentTouch: nextTouch?.touchNumber ?? touchNumber,
      lastTouchDate: sentAt,
      nextActionDate: nextTouch?.scheduledAt ?? null,
      nextActionType: nextTouch?.channel ?? null
    }
  };
}

export function applyColdTargetOutcome(target: ColdTargetLike, outcome: ColdTargetOutcome, now: Date) {
  const reviewOffsetDays = outcome === "not_interested" ? 90 : 30;

  return {
    ...target,
    outcome,
    nextActionDate: null,
    nextActionType: null,
    nextReviewDate: outcome === "interested" ? null : addDays(now, reviewOffsetDays)
  };
}

export function buildConvertedColdTargetRecords({
  target,
  clientId,
  leadId,
  clientRecordId,
  leadRecordId,
  convertedAt
}: {
  target: ColdTargetLike;
  clientId: string;
  leadId: string;
  clientRecordId: string;
  leadRecordId: string;
  convertedAt: Date;
}) {
  return {
    client: {
      workspaceId: target.workspaceId,
      clientId,
      name: target.companyName,
      clientType: "company",
      email: target.email,
      phone: target.phone,
      source: "cold_outreach",
      notes: target.notesResearch
    },
    lead: {
      workspaceId: target.workspaceId,
      leadId,
      clientRecordId,
      temperature: "warm",
      requestType: "bautraeger_outreach",
      status: "new",
      rawInput: `Converted from cold outreach target ${target.companyName}.`
    },
    targetUpdate: {
      clientRecordId,
      leadRecordId,
      outcome: "interested",
      nextActionDate: null,
      nextActionType: null,
      convertedAt,
      archivedAt: convertedAt
    }
  };
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function splitDelimitedLine(line: string): string[] {
  if (line.includes("\t")) {
    return line.split("\t");
  }

  return splitCsvLine(line);
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function createDuplicateKey(row: ColdTargetImportRow): string {
  return [row.companyName, row.website, row.email].map((value) => value?.trim().toLowerCase() ?? "").join("|");
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
