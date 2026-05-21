import type { CreateLeadFromAssistantInput, CreatedLeadRecord, MarkKpSentFromAssistantInput, MarkedKpSentLeadRecord } from "@app/assistant";

type LeadRow = {
  id: string;
  workspaceId: string;
  leadId: string;
  status: string;
  rawInput: string | null;
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
    rawInput: row.rawInput ?? ""
  };
}
