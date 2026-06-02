export type SaveLeadEntityExtractionInput = {
  workspaceId: string;
  leadRecordId: string;
  leadId: string;
  sourceChannel: string;
  sourceMessageId?: string | null;
  actorUserId?: string | null;
  entities: Array<{
    type: string;
    label: string;
    value: string;
    normalizedKey?: string | null;
    sourceText?: string | null;
    confidence: string;
  }>;
  calendarActions: Array<{
    title: string;
    description?: string | null;
    dueAt?: Date | null;
    recurrence?: string | null;
  }>;
  summary: string;
};

export type CrmEntityPrismaLike = {
  leadContextEntity: { createMany(args: unknown): Promise<{ count: number }> };
  crmCalendarAction: { createMany(args: unknown): Promise<{ count: number }> };
  auditLog: { createMany(args: unknown): Promise<{ count: number }> };
};

export function createCrmEntityPrismaStore(client: CrmEntityPrismaLike) {
  return {
    async saveLeadEntityExtraction(input: SaveLeadEntityExtractionInput) {
      await client.leadContextEntity.createMany({
        data: input.entities.map((entity) => ({
          workspaceId: input.workspaceId,
          leadRecordId: input.leadRecordId,
          sourceChannel: input.sourceChannel,
          sourceMessageId: input.sourceMessageId ?? null,
          entityType: entity.type,
          label: entity.label,
          value: entity.value,
          normalizedKey: entity.normalizedKey ?? null,
          sourceText: entity.sourceText ?? null,
          confidence: entity.confidence,
          actorUserId: input.actorUserId ?? null
        }))
      });

      await client.crmCalendarAction.createMany({
        data: input.calendarActions.map((action) => ({
          workspaceId: input.workspaceId,
          leadRecordId: input.leadRecordId,
          title: action.title,
          description: action.description ?? null,
          dueAt: action.dueAt ?? null,
          recurrence: action.recurrence ?? null,
          sourceChannel: input.sourceChannel,
          sourceMessageId: input.sourceMessageId ?? null,
          actorUserId: input.actorUserId ?? null
        }))
      });

      await client.auditLog.createMany({
        data: [
          {
            workspaceId: input.workspaceId,
            actorUserId: input.actorUserId ?? null,
            action: "lead.entity_extraction_saved",
            targetType: "lead",
            targetId: input.leadId,
            metadata: {
              summary: input.summary,
              entityCount: input.entities.length,
              calendarActionCount: input.calendarActions.length
            }
          }
        ]
      });
    }
  };
}
