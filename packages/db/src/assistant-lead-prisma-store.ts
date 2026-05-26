import type { CreateLeadFromAssistantInput, CreatedLeadRecord, MarkKpSentFromAssistantInput, MarkedKpSentLeadRecord } from "@app/assistant";
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
  markKpSent(input: MarkKpSentFromAssistantInput): Promise<MarkedKpSentLeadRecord>;
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
      const row = await client.lead.create({
        data: input
      });

      return toCreatedLeadRecord(row);
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
    }
  };
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
