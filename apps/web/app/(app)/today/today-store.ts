import { getDueFollowups, parseFollowupIdDueDate, type FollowupListItem } from "@app/core";
import type { CreatedFollowupRecord } from "@app/assistant";
import { prisma } from "@app/db";
import { selectDatabaseBackedRuntime } from "../../../lib/database-runtime";
import { listAssistantCreatedFollowups } from "../assistant/followup-execution-store";
import type { LeadCalendarItem } from "../leads/lead-table-store";

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
  lead?: { leadId: string; displayName?: string | null } | null;
  title: string;
  description?: string | null;
  dueAt?: Date | string | null;
  recurrence?: string | null;
  status?: string | null;
  sourceChannel?: string | null;
  actorUserId?: string | null;
};

export type TodayLeadFollowupRecord = {
  id: string;
  leadId: string;
  displayName?: string | null;
  followup1Date?: Date | string | null;
  followupStatus?: string | null;
  outcome?: string | null;
};

export type TodayCalendarViewModel = {
  nextSummary: string;
  initialMonth: string;
  items: LeadCalendarItem[];
  todayItems: LeadCalendarItem[];
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

export async function listWorkspaceCalendar(workspaceId: string, today = new Date()): Promise<TodayCalendarViewModel> {
  const runtime = selectDatabaseBackedRuntime({
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    memoryRuntime: "memory" as const,
    databaseRuntime: "prisma" as const,
    runtimeName: "workspace calendar actions"
  });

  const assistantRecords = await listAssistantCreatedFollowups(workspaceId);
  const assistantItems = createTodayAssistantCalendarItems(assistantRecords, { workspaceId });

  if (runtime !== "prisma") {
    return createTodayCalendarViewModel(assistantItems, today);
  }

  const records = await prisma.crmCalendarAction.findMany({
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
      status: true,
      sourceChannel: true,
      actorUserId: true,
      lead: {
        select: {
          leadId: true,
          displayName: true
        }
      }
    }
  });
  const leadFollowups = await prisma.lead.findMany({
    where: {
      workspaceId,
      archivedAt: null,
      followup1Date: { not: null }
    },
    orderBy: [{ followup1Date: "asc" }, { createdDate: "desc" }],
    select: {
      id: true,
      leadId: true,
      displayName: true,
      followup1Date: true,
      followupStatus: true,
      outcome: true
    }
  });

  return createTodayCalendarViewModel(
    dedupeWorkspaceCalendarItems([
      ...assistantItems,
      ...createWorkspaceCalendarItems(records, { workspaceId }),
      ...createLeadFollowupCalendarItems(leadFollowups)
    ]),
    today
  );
}

export function createWorkspaceCalendarItems(
  records: TodayCalendarActionRecord[],
  filters: { workspaceId: string }
): LeadCalendarItem[] {
  const items: LeadCalendarItem[] = [];

  for (const record of records) {
    if (record.workspaceId !== filters.workspaceId || !record.dueAt) {
      continue;
    }

    const date = formatCalendarDate(record.dueAt);
    if (!date) {
      continue;
    }

    const kind = classifyWorkspaceCalendarKind(record.title, record.description, record.recurrence);
    const badge = createWorkspaceCalendarBadge(kind, record.recurrence ?? null);
    items.push({
      id: record.id,
      title: record.title || "Calendar action",
      date,
      status: record.status || "planned",
      description: record.description || "No description yet.",
      kind,
      recurrence: record.recurrence ?? null,
      badgeLabel: badge.label,
      badgeTone: badge.tone,
      sourceLabel: record.sourceChannel || "CRM",
      leadId: record.lead?.leadId ?? undefined,
      leadName: record.lead?.displayName ?? record.lead?.leadId ?? undefined
    });
  }

  return items.sort((left, right) => left.date.localeCompare(right.date));
}

export function createLeadFollowupCalendarItems(records: TodayLeadFollowupRecord[]): LeadCalendarItem[] {
  return records
    .filter((record) => !record.outcome)
    .map((record): LeadCalendarItem | null => {
      const date = formatCalendarDate(record.followup1Date);
      if (!date) {
        return null;
      }

      return {
        id: `lead-followup-${record.id}-${date}`,
        title: "Follow up",
        date,
        status: record.followupStatus || "planned",
        description: "Check client reaction and update outcome.",
        kind: "followup",
        recurrence: null,
        badgeLabel: "Follow-up",
        badgeTone: "amber",
        sourceLabel: "Lead follow-up",
        leadId: record.leadId,
        leadName: record.displayName ?? record.leadId
      };
    })
    .filter((item): item is LeadCalendarItem => item !== null);
}

export function createTodayCalendarViewModel(items: LeadCalendarItem[], today = new Date()): TodayCalendarViewModel {
  const todayLabel = formatCalendarDate(today) || new Date().toISOString().slice(0, 10);
  const sortedItems = [...items].sort((left, right) => left.date.localeCompare(right.date));
  const nextItem = sortedItems.find((item) => item.date >= todayLabel) ?? sortedItems[0];
  const todayItems = sortedItems.filter((item) => item.date === todayLabel);

  return {
    nextSummary: nextItem
      ? `Next: ${nextItem.date} - ${nextItem.title}${nextItem.leadName ? ` (${nextItem.leadName})` : ""}`
      : "No scheduled actions yet.",
    initialMonth: nextItem?.date.slice(0, 7) ?? todayLabel.slice(0, 7),
    items: sortedItems,
    todayItems
  };
}

function dedupeWorkspaceCalendarItems(items: LeadCalendarItem[]): LeadCalendarItem[] {
  const seen = new Set<string>();
  const result: LeadCalendarItem[] = [];

  for (const item of items) {
    const key = [item.leadId ?? "", item.date, item.kind, item.title.toLowerCase()].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }

  return result;
}

function createTodayAssistantCalendarItems(
  records: CreatedFollowupRecord[],
  filters: { workspaceId: string }
): LeadCalendarItem[] {
  return records
    .filter((record) => record.workspaceId === filters.workspaceId)
    .map((record): LeadCalendarItem | null => {
      const dueDate = parseFollowupIdDueDate(record.followupId);
      if (!dueDate) return null;
      const date = dueDate.toISOString().slice(0, 10);

      return {
        id: record.id,
        title: record.followupId,
        date,
        status: "pending",
        description: record.rawInput,
        kind: "followup",
        recurrence: null,
        badgeLabel: "Follow-up",
        badgeTone: "amber",
        sourceLabel: "Assistant follow-up"
      };
    })
    .filter((item): item is LeadCalendarItem => item !== null);
}

function formatCalendarDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function classifyWorkspaceCalendarKind(
  title: string,
  description: string | null | undefined,
  recurrence: string | null | undefined
): LeadCalendarItem["kind"] {
  const text = `${title} ${description ?? ""} ${recurrence ?? ""}`.toLowerCase();
  if (/birthday|birth day|\u0434\u0435\u043d\u044c \u0440\u043e\u0436\u0434\u0435\u043d\u0438\u044f|\u0434\u0440\b|geburtstag/.test(text)) return "birthday";
  if (/follow[- ]?up|followup|\u043f\u0435\u0440\u0435\u0437\u0432\u043e\u043d|\u0441\u043e\u0437\u0432\u043e\u043d|\u043d\u0430\u043f\u0438\u0441\u0430\u0442\u044c|\u043f\u043e\u0437\u0432\u043e\u043d\u0438\u0442\u044c|\u0443\u0442\u043e\u0447\u043d\u0438\u0442\u044c|\u043f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c|ping|\u043f\u0438\u043d\u0433/.test(text)) return "followup";
  if (/remind|reminder|\u043d\u0430\u043f\u043e\u043c/.test(text)) return "reminder";
  return "event";
}

function createWorkspaceCalendarBadge(
  kind: LeadCalendarItem["kind"],
  recurrence: string | null
): { label: string; tone: LeadCalendarItem["badgeTone"] } {
  if (kind === "birthday") return { label: recurrence === "yearly" ? "DR yearly" : "DR", tone: "rose" };
  if (recurrence === "yearly") return { label: "Yearly", tone: "emerald" };
  if (kind === "followup") return { label: "Follow-up", tone: "amber" };
  if (kind === "reminder") return { label: "Reminder", tone: "blue" };
  return { label: "Event", tone: "neutral" };
}
