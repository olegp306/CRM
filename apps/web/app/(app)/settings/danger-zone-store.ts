type LeadTablePrismaLike = {
  lead: {
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
        metadata: { deletedCount: number };
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

  const result = await client.lead.deleteMany({ where: { workspaceId: input.workspaceId } });
  await client.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "settings.leads.clear_table",
      targetType: "Lead",
      targetId: null,
      metadata: { deletedCount: result.count }
    }
  });

  return { deletedCount: result.count };
}
