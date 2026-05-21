import { getNextBusinessId, type LeadIntakeDraft } from "@app/core";
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
      temperature: input.draft.source === "telegram" ? "hot" : "warm"
    }
  });
}

export async function createLeadFromIntakeDraft(input: CreateLeadRecordFromIntakeDraftInput): Promise<LeadRow> {
  return createLeadRecordFromIntakeDraft(prisma, input);
}
