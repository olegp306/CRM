import type { CreateLeadFromAssistantInput, CreatedLeadRecord, MarkKpSentFromAssistantInput, MarkedKpSentLeadRecord } from "@app/assistant";
import { createAssistantLeadPrismaStore, prisma, type AssistantLeadStore } from "@app/db";
import { selectDatabaseBackedRuntime } from "../../../lib/database-runtime";

const globalForAssistantLeads = globalThis as typeof globalThis & {
  assistantCreatedLeads?: CreatedLeadRecord[];
  assistantLeadPrismaStore?: AssistantLeadStore;
};

function getStore() {
  if (!globalForAssistantLeads.assistantCreatedLeads) {
    globalForAssistantLeads.assistantCreatedLeads = [];
  }

  return globalForAssistantLeads.assistantCreatedLeads;
}

export function selectAssistantLeadStoreRuntime<TStore>({
  databaseUrl,
  nodeEnv,
  memoryStore,
  prismaStore
}: {
  databaseUrl?: string;
  nodeEnv?: string;
  memoryStore: TStore;
  prismaStore: TStore;
}): TStore {
  return selectDatabaseBackedRuntime({
    databaseUrl,
    nodeEnv,
    memoryRuntime: memoryStore,
    databaseRuntime: prismaStore,
    runtimeName: "assistant lead store"
  });
}

function getAssistantLeadStore(): AssistantLeadStore {
  const memoryStore: AssistantLeadStore = {
    async list(workspaceId) {
      return getStore().filter((lead) => lead.workspaceId === workspaceId);
    },
    async create(input) {
      const lead: CreatedLeadRecord = {
        id: `lead-record-${Date.now()}`,
        ...input
      };

      getStore().push(lead);
      return lead;
    },
    async markKpSent(input) {
      const lead = getStore().find((item) => item.workspaceId === input.workspaceId && item.leadId === input.leadId);

      if (!lead) {
        throw new Error(`Lead ${input.leadId} was not found`);
      }

      lead.status = input.status;
      const result: MarkedKpSentLeadRecord = {
        id: lead.id,
        workspaceId: input.workspaceId,
        leadId: input.leadId,
        status: input.status,
        kpSentDate: input.kpSentDate,
        followup1Date: input.followup1Date,
        followupStatus: input.followupStatus,
        requestedByUserId: input.requestedByUserId
      };

      return result;
    }
  };

  if (!globalForAssistantLeads.assistantLeadPrismaStore) {
    globalForAssistantLeads.assistantLeadPrismaStore = createAssistantLeadPrismaStore(prisma);
  }

  return selectAssistantLeadStoreRuntime({
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    memoryStore,
    prismaStore: globalForAssistantLeads.assistantLeadPrismaStore
  });
}

export async function listAssistantCreatedLeads(workspaceId: string): Promise<CreatedLeadRecord[]> {
  return getAssistantLeadStore().list(workspaceId);
}

export async function createAssistantLead(input: CreateLeadFromAssistantInput): Promise<CreatedLeadRecord> {
  return getAssistantLeadStore().create(input);
}

export async function markAssistantLeadKpSent(input: MarkKpSentFromAssistantInput): Promise<MarkedKpSentLeadRecord> {
  return getAssistantLeadStore().markKpSent(input);
}
