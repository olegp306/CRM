import { getDueFollowups, parseFollowupIdDueDate, type FollowupListItem } from "@app/core";
import type { CreatedFollowupRecord } from "@app/assistant";
import { prisma } from "@app/db";
import { selectDatabaseBackedRuntime } from "../../../lib/database-runtime";
import { listAssistantCreatedFollowups } from "../assistant/followup-execution-store";

export type TodayFollowupRow = {
  id: string;
  followupId: string;
  dueDateLabel: string;
  rawInput: string;
  requestedByUserId: string;
  status: "pending";
  leadId?: string | null;
  source?: "assistant_followup" | "crm_entity_extractor";
};

export type TodayCalendarActionRecord = {
  id: string;
  workspaceId: string;
  leadRecordId: string | null;
  lead?: { leadId: string } | null;
  title: string;
  description?: string | null;
  dueAt?: Date | string | null;
  recurrence?: string | null;
  actorUserId?: string | null;
};

export function createTodayFollowupViewModel(
  records: CreatedFollowupRecord[],
  filters: { workspaceId: string; today: Date }
): TodayFollowupRow[] {
  const items: FollowupListItem[] = records.map((record) => ({
    id: record.id,
    workspaceId: record.workspaceId,
    followupId: record.followupId,
    dueDate: parseFollowupIdDueDate(record.followupId) ?? filters.today,
    status: "pending",
    rawInput: record.rawInput,
    requestedByUserId: record.requestedByUserId
  }));

  return getDueFollowups(items, filters).map((item) => ({
    id: item.id,
    followupId: item.followupId,
    dueDateLabel: item.dueDate.toISOString().slice(0, 10),
    rawInput: item.rawInput,
    requestedByUserId: item.requestedByUserId,
    status: "pending",
    source: "assistant_followup"
  }));
}

export async function listTodayFollowups(workspaceId: string, today = new Date()): Promise<TodayFollowupRow[]> {
  const records = await listAssistantCreatedFollowups(workspaceId);
  const assistantRows = createTodayFollowupViewModel(records, { workspaceId, today });
  const runtime = selectDatabaseBackedRuntime({
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    memoryRuntime: "memory" as const,
    databaseRuntime: "prisma" as const,
    runtimeName: "today calendar actions"
  });

  if (runtime !== "prisma") {
    return assistantRows;
  }

  const calendarActions = await prisma.crmCalendarAction.findMany({
    where: { workspaceId },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      workspaceId: true,
      leadRecordId: true,
      title: true,
      description: true,
      dueAt: true,
      recurrence: true,
      actorUserId: true,
      lead: {
        select: {
          leadId: true
        }
      }
    }
  });

  return [...assistantRows, ...createTodayCalendarActionViewModel(calendarActions, { workspaceId, today })].sort((left, right) =>
    left.dueDateLabel.localeCompare(right.dueDateLabel)
  );
}

export function createTodayCalendarActionViewModel(
  records: TodayCalendarActionRecord[],
  filters: { workspaceId: string; today: Date }
): TodayFollowupRow[] {
  const items: FollowupListItem[] = records
    .filter((record) => record.workspaceId === filters.workspaceId)
    .map((record) => ({
      id: record.id,
      workspaceId: record.workspaceId,
      followupId: record.title,
      dueDate: record.dueAt ? new Date(record.dueAt) : filters.today,
      status: "pending",
      rawInput: record.description ?? record.title,
      requestedByUserId: record.actorUserId ?? "crm_entity_extractor"
    }));
  const recordsById = new Map(records.map((record) => [record.id, record]));

  return getDueFollowups(items, filters).map((item) => {
    const record = recordsById.get(item.id);

    return {
      id: item.id,
      followupId: item.followupId,
      dueDateLabel: item.dueDate.toISOString().slice(0, 10),
      rawInput: item.rawInput,
      requestedByUserId: item.requestedByUserId,
      status: "pending",
      leadId: record?.lead?.leadId ?? null,
      source: "crm_entity_extractor"
    };
  });
}
