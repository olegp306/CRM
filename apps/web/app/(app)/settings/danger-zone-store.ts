type LeadTablePrismaLike = {
  leadContextEntity: {
    deleteMany(args: { where: { workspaceId: string; leadRecordId: { in: string[] } } }): Promise<{ count: number }>;
  };
  crmCalendarAction: {
    deleteMany(args: { where: { workspaceId: string; leadRecordId: { in: string[] } } }): Promise<{ count: number }>;
  };
  lead: {
    findMany(args: { where: { workspaceId: string }; select: { id: true } }): Promise<Array<{ id: string }>>;
    deleteMany(args: { where: { workspaceId: string } }): Promise<{ count: number }>;
  };
  auditLog: {
    create(args: {
      data: {
        workspaceId: string;
        actorUserId: string;
        action: string;
        targetType: string;
        targetId: string | null;
        metadata: { deletedCount: number; deletedContextEntityCount: number; deletedCalendarActionCount: number };
      };
    }): Promise<unknown>;
  };
};

export const CLEAR_LEADS_PASSWORD = "191181";

export async function clearWorkspaceLeadTable(
  client: LeadTablePrismaLike,
  input: { workspaceId: string; actorUserId: string; password: string }
): Promise<{ deletedCount: number }> {
  if (input.password !== CLEAR_LEADS_PASSWORD) {
    throw new Error("Invalid confirmation password.");
  }

  const leads = await client.lead.findMany({
    where: { workspaceId: input.workspaceId },
    select: { id: true }
  });
  const leadRecordIds = leads.map((lead) => lead.id);
  const deletedContextEntities =
    leadRecordIds.length > 0
      ? await client.leadContextEntity.deleteMany({
          where: { workspaceId: input.workspaceId, leadRecordId: { in: leadRecordIds } }
        })
      : { count: 0 };
  const deletedCalendarActions =
    leadRecordIds.length > 0
      ? await client.crmCalendarAction.deleteMany({
          where: { workspaceId: input.workspaceId, leadRecordId: { in: leadRecordIds } }
        })
      : { count: 0 };
  const result = await client.lead.deleteMany({ where: { workspaceId: input.workspaceId } });
  await client.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "settings.leads.clear_table",
      targetType: "Lead",
      targetId: null,
      metadata: {
        deletedCount: result.count,
        deletedContextEntityCount: deletedContextEntities.count,
        deletedCalendarActionCount: deletedCalendarActions.count
      }
    }
  });

  return { deletedCount: result.count };
}
