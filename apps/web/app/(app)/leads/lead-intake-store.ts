import { findMatchingClient, getNextBusinessId, type LeadIntakeDraft } from "@app/core";
import { prisma } from "@app/db";

type LeadRow = {
  id: string;
  leadId: string;
  status: string;
  rawInput: string | null;
  requestType: string | null;
  projectAddress: string | null;
};

export type LeadIntakePrismaClientLike = {
  client?: {
    findMany(args: unknown): Promise<Array<{ id: string; clientId: string; name: string; email?: string | null; phone?: string | null }>>;
    create(args: unknown): Promise<{ id: string; clientId: string }>;
  };
  lead: {
    findMany(args: unknown): Promise<Array<{ leadId: string }>>;
    create(args: unknown): Promise<LeadRow>;
  };
};

export type CreateLeadRecordFromIntakeDraftInput = {
  workspaceId: string;
  now: Date;
  draft: LeadIntakeDraft;
};

export async function createLeadRecordFromIntakeDraft(
  client: LeadIntakePrismaClientLike,
  input: CreateLeadRecordFromIntakeDraftInput
): Promise<LeadRow> {
  const existingLeads = await client.lead.findMany({
    where: { workspaceId: input.workspaceId },
    select: { leadId: true }
  });
  const leadId = getNextBusinessId({
    kind: "lead",
    now: input.now,
    existingIds: existingLeads.map((lead) => lead.leadId)
  });
  const clientRecordId = await resolveOrCreateClientForLeadDraft(client, input);

  return client.lead.create({
    data: {
      workspaceId: input.workspaceId,
      leadId,
      status: input.draft.missingData.length > 0 ? "needs_data" : "new",
      rawInput: input.draft.rawInput,
      requestType: input.draft.requestType,
      projectAddress: input.draft.projectAddress,
      bgfM2: input.draft.bgfM2,
      isStandard: input.draft.isStandard,
      missingData: input.draft.missingData,
      temperature: input.draft.source === "telegram" ? "hot" : "warm",
      ...(clientRecordId ? { clientRecordId } : {})
    }
  });
}

export async function createLeadFromIntakeDraft(input: CreateLeadRecordFromIntakeDraftInput): Promise<LeadRow> {
  return createLeadRecordFromIntakeDraft(prisma, input);
}

async function resolveOrCreateClientForLeadDraft(
  client: LeadIntakePrismaClientLike,
  input: CreateLeadRecordFromIntakeDraftInput
): Promise<string | null> {
  if (!client.client || !hasEnoughClientDataForAutoCreate(input.draft)) {
    return null;
  }

  const existingClients = await client.client.findMany({
    where: { workspaceId: input.workspaceId, archivedAt: null },
    select: {
      id: true,
      clientId: true,
      name: true,
      email: true,
      phone: true
    }
  });
  const match = findMatchingClient(existingClients, {
    name: input.draft.clientName,
    email: input.draft.email,
    phone: input.draft.phone
  });

  if (match.match) {
    return match.match.id;
  }

  const clientId = getNextBusinessId({
    kind: "client",
    now: input.now,
    existingIds: existingClients.map((record) => record.clientId)
  });
  const created = await client.client.create({
    data: {
      workspaceId: input.workspaceId,
      clientId,
      name: input.draft.clientName,
      clientType: "private",
      email: input.draft.email,
      phone: input.draft.phone,
      source: input.draft.source
    }
  });

  return created.id;
}

function hasEnoughClientDataForAutoCreate(draft: LeadIntakeDraft): boolean {
  return Boolean(draft.clientName?.trim() && (draft.email?.trim() || draft.phone?.trim()));
}
