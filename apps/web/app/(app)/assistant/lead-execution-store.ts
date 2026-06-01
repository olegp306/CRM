import type {
  CreateLeadFromAssistantInput,
  CreatedLeadRecord,
  MarkKpSentFromAssistantInput,
  MarkedKpSentLeadRecord,
  UpdateLeadFromAssistantInput,
  UpdatedLeadRecord,
  UndoKpSentFromAssistantInput,
  UndoneKpSentLeadRecord,
  LeadSearchRecord
} from "@app/assistant";
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
    async update(input) {
      const lead = getStore().find((item) => item.workspaceId === input.workspaceId && item.leadId === input.leadId);

      if (!lead) {
        throw new Error(`Lead ${input.leadId} was not found`);
      }

      lead.rawInput = [lead.rawInput?.trim(), `Assistant update from ${input.requestedByUserId}:\n${input.rawInput.trim()}`]
        .filter(Boolean)
        .join("\n\n");
      lead.clientName = input.clientName ?? lead.clientName;
      lead.requestType = input.requestType ?? lead.requestType;
      lead.projectAddress = input.projectAddress ?? lead.projectAddress;
      lead.bgfM2 = input.bgfM2 ?? lead.bgfM2;
      lead.email = input.email ?? lead.email;
      lead.phone = input.phone ?? lead.phone;
      lead.missingData = input.missingData ?? lead.missingData;
      lead.isStandard = input.isStandard ?? lead.isStandard;
      lead.temperature = input.temperature ?? lead.temperature;

      const result: UpdatedLeadRecord = {
        id: lead.id,
        workspaceId: input.workspaceId,
        leadId: input.leadId,
        status: lead.status,
        rawInput: lead.rawInput,
        requestedByUserId: input.requestedByUserId
      };

      return result;
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
    },
    async undoKpSent(input) {
      const lead = getStore().find((item) => item.workspaceId === input.workspaceId && item.leadId === input.leadId);

      if (!lead) {
        throw new Error(`Lead ${input.leadId} was not found`);
      }

      const result: UndoneKpSentLeadRecord = {
        id: lead.id,
        workspaceId: input.workspaceId,
        leadId: input.leadId,
        kpSentDate: null,
        followup1Date: null,
        followupStatus: null,
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

export async function listAssistantLeadSearchRecords(workspaceId: string): Promise<LeadSearchRecord[]> {
  const runtime = selectAssistantLeadStoreRuntime({
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    memoryStore: "memory" as const,
    prismaStore: "prisma" as const
  });

  if (runtime === "prisma") {
    const records = await prisma.lead.findMany({
      where: { workspaceId, archivedAt: null },
      orderBy: [{ createdDate: "desc" }, { leadId: "asc" }],
      select: {
        id: true,
        leadId: true,
        createdDate: true,
        status: true,
        temperature: true,
        requestType: true,
        projectAddress: true,
        client: {
          select: {
            name: true
          }
        }
      }
    });

    return records.map((record) => ({
      id: record.id,
      leadId: record.leadId,
      createdDate: record.createdDate,
      status: record.status,
      temperature: record.temperature,
      requestType: record.requestType,
      projectAddress: record.projectAddress,
      clientName: record.client?.name ?? null
    }));
  }

  return getStore()
    .filter((lead) => lead.workspaceId === workspaceId)
    .map((lead) => ({
      id: lead.id,
      leadId: lead.leadId,
      createdDate: (lead as CreatedLeadRecord & { createdDate?: string | Date }).createdDate ?? new Date(0),
      status: lead.status,
      temperature: lead.temperature,
      requestType: lead.requestType,
      projectAddress: lead.projectAddress,
      clientName: lead.clientName
    }));
}

export async function createAssistantLead(input: CreateLeadFromAssistantInput): Promise<CreatedLeadRecord> {
  return getAssistantLeadStore().create(input);
}

export async function updateAssistantLead(input: UpdateLeadFromAssistantInput): Promise<UpdatedLeadRecord> {
  return getAssistantLeadStore().update(input);
}

export async function scheduleAssistantLeadReminder(input: {
  workspaceId: string;
  leadId: string;
  followup1Date: Date;
  followupStatus: "planned";
}): Promise<void> {
  const runtime = selectAssistantLeadStoreRuntime({
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    memoryStore: "memory" as const,
    prismaStore: "prisma" as const
  });

  if (runtime === "prisma") {
    await prisma.lead.update({
      where: {
        workspaceId_leadId: {
          workspaceId: input.workspaceId,
          leadId: input.leadId
        }
      },
      data: {
        followup1Date: input.followup1Date,
        followupStatus: input.followupStatus
      }
    });
    return;
  }

  const lead = getStore().find((item) => item.workspaceId === input.workspaceId && item.leadId === input.leadId) as
    | (CreatedLeadRecord & { followup1Date?: Date; followupStatus?: string | null })
    | undefined;

  if (!lead) {
    throw new Error(`Lead ${input.leadId} was not found`);
  }

  lead.followup1Date = input.followup1Date;
  lead.followupStatus = input.followupStatus;
}

export async function markAssistantLeadKpSent(input: MarkKpSentFromAssistantInput): Promise<MarkedKpSentLeadRecord> {
  return getAssistantLeadStore().markKpSent(input);
}

export async function undoAssistantLeadKpSent(input: UndoKpSentFromAssistantInput): Promise<UndoneKpSentLeadRecord> {
  return getAssistantLeadStore().undoKpSent(input);
}
