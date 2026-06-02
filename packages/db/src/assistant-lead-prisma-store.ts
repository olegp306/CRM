import type {
  CreateLeadFromAssistantInput,
  CreatedLeadRecord,
  MarkKpSentFromAssistantInput,
  MarkedKpSentLeadRecord,
  UpdateLeadFromAssistantInput,
  UpdatedLeadRecord,
  UndoKpSentFromAssistantInput,
  UndoneKpSentLeadRecord
} from "@app/assistant";
import { createLeadDisplayMetadata } from "@app/assistant";
import type { LeadMissingField } from "@app/core";

type LeadRow = {
  id: string;
  workspaceId: string;
  leadId: string;
  status: string;
  rawInput: string | null;
  clientName?: string | null;
  requestType?: string | null;
  projectAddress?: string | null;
  displayName?: string | null;
  language?: string | null;
  country?: string | null;
  searchTags?: unknown;
  bgfM2?: { toString(): string } | number | null;
  email?: string | null;
  phone?: string | null;
  missingData?: unknown;
  isStandard?: boolean | null;
  temperature?: string | null;
};

export type AssistantLeadPrismaClientLike = {
  lead: {
    findMany(args: unknown): Promise<LeadRow[]>;
    create(args: unknown): Promise<LeadRow>;
    update(args: unknown): Promise<LeadRow>;
  };
};

export type AssistantLeadStore = {
  list(workspaceId: string): Promise<CreatedLeadRecord[]>;
  create(input: CreateLeadFromAssistantInput): Promise<CreatedLeadRecord>;
  update(input: UpdateLeadFromAssistantInput): Promise<UpdatedLeadRecord>;
  markKpSent(input: MarkKpSentFromAssistantInput): Promise<MarkedKpSentLeadRecord>;
  undoKpSent(input: UndoKpSentFromAssistantInput): Promise<UndoneKpSentLeadRecord>;
};

export function createAssistantLeadPrismaStore(client: AssistantLeadPrismaClientLike): AssistantLeadStore {
  return {
    async list(workspaceId) {
      const rows = await client.lead.findMany({
        where: { workspaceId },
        orderBy: { createdDate: "desc" }
      });

      return rows.map(toCreatedLeadRecord);
    },

    async create(input) {
      const displayMetadata = createLeadDisplayMetadata({
        clientName: input.clientName,
        requestType: input.requestType,
        projectAddress: input.projectAddress,
        leadSummary: input.rawInput
      });
      const row = await client.lead.create({
        data: {
          ...input,
          displayName: displayMetadata.displayName,
          language: displayMetadata.language,
          country: displayMetadata.country,
          searchTags: displayMetadata.searchTags
        }
      });

      return toCreatedLeadRecord(row);
    },

    async update(input) {
      const [existing] = await client.lead.findMany({
        where: {
          workspaceId: input.workspaceId,
          leadId: input.leadId
        },
        take: 1
      });
      const rawInput = appendAssistantLeadUpdate(existing?.rawInput, input.requestedByUserId, input.rawInput);
      const data = createLeadUpdateData(input, rawInput);
      const row = await client.lead.update({
        where: {
          workspaceId_leadId: {
            workspaceId: input.workspaceId,
            leadId: input.leadId
          }
        },
        data
      });

      return {
        id: row.id,
        workspaceId: row.workspaceId,
        leadId: row.leadId,
        status: row.status,
        rawInput: row.rawInput ?? rawInput,
        requestedByUserId: input.requestedByUserId
      };
    },

    async markKpSent(input) {
      const row = await client.lead.update({
        where: {
          workspaceId_leadId: {
            workspaceId: input.workspaceId,
            leadId: input.leadId
          }
        },
        data: {
          status: input.status,
          kpSentDate: input.kpSentDate,
          followup1Date: input.followup1Date,
          followupStatus: input.followupStatus
        }
      });

      return {
        id: row.id,
        workspaceId: row.workspaceId,
        leadId: row.leadId,
        status: input.status,
        kpSentDate: input.kpSentDate,
        followup1Date: input.followup1Date,
        followupStatus: input.followupStatus,
        requestedByUserId: input.requestedByUserId
      };
    },

    async undoKpSent(input) {
      const row = await client.lead.update({
        where: {
          workspaceId_leadId: {
            workspaceId: input.workspaceId,
            leadId: input.leadId
          }
        },
        data: {
          kpSentDate: null,
          followup1Date: null,
          followupStatus: null
        }
      });

      return {
        id: row.id,
        workspaceId: row.workspaceId,
        leadId: row.leadId,
        kpSentDate: null,
        followup1Date: null,
        followupStatus: null,
        requestedByUserId: input.requestedByUserId
      };
    }
  };
}

function createLeadUpdateData(input: UpdateLeadFromAssistantInput, rawInput: string): Record<string, unknown> {
  const data: Record<string, unknown> = { rawInput };
  const shouldRefreshDisplayMetadata =
    input.clientName !== undefined || input.requestType !== undefined || input.projectAddress !== undefined;

  if (shouldRefreshDisplayMetadata) {
    const displayMetadata = createLeadDisplayMetadata({
      clientName: input.clientName,
      requestType: input.requestType,
      projectAddress: input.projectAddress,
      leadSummary: rawInput
    });
    data.displayName = displayMetadata.displayName;
    data.language = displayMetadata.language;
    data.country = displayMetadata.country;
    data.searchTags = displayMetadata.searchTags;
  }
  const optionalFields: Array<keyof Pick<
    UpdateLeadFromAssistantInput,
    "clientName" | "requestType" | "projectAddress" | "bgfM2" | "email" | "phone" | "missingData" | "isStandard" | "temperature"
  >> = ["clientName", "requestType", "projectAddress", "bgfM2", "email", "phone", "missingData", "isStandard", "temperature"];

  for (const field of optionalFields) {
    if (input[field] !== undefined) {
      data[field] = input[field];
    }
  }

  return data;
}

function appendAssistantLeadUpdate(existingRawInput: string | null | undefined, requestedByUserId: string, rawInput: string): string {
  return [existingRawInput?.trim(), `Assistant update from ${requestedByUserId}:\n${rawInput.trim()}`].filter(Boolean).join("\n\n");
}

function toCreatedLeadRecord(row: LeadRow): CreatedLeadRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    leadId: row.leadId,
    status: row.status,
    rawInput: row.rawInput ?? "",
    clientName: row.clientName ?? null,
    requestType: row.requestType ?? null,
    projectAddress: row.projectAddress ?? null,
    bgfM2: normalizeNumber(row.bgfM2),
    email: row.email ?? null,
    phone: row.phone ?? null,
    missingData: normalizeMissingData(row.missingData),
    isStandard: row.isStandard ?? false,
    temperature: row.temperature === "cold" || row.temperature === "hot" || row.temperature === "unknown" ? row.temperature : "warm"
  };
}

function normalizeNumber(value: { toString(): string } | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (!value) {
    return null;
  }

  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMissingData(value: unknown): LeadMissingField[] {
  const allowed = new Set<LeadMissingField>(["clientName", "requestType", "projectAddress", "bgfM2"]);

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is LeadMissingField => typeof item === "string" && allowed.has(item as LeadMissingField));
}
