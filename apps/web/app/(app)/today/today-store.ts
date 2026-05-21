import { getDueFollowups, parseFollowupIdDueDate, type FollowupListItem } from "@app/core";
import type { CreatedFollowupRecord } from "@app/assistant";
import { listAssistantCreatedFollowups } from "../assistant/followup-execution-store";

export type TodayFollowupRow = {
  id: string;
  followupId: string;
  dueDateLabel: string;
  rawInput: string;
  requestedByUserId: string;
  status: "pending";
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
    status: "pending"
  }));
}

export async function listTodayFollowups(workspaceId: string, today = new Date()): Promise<TodayFollowupRow[]> {
  const records = await listAssistantCreatedFollowups(workspaceId);
  return createTodayFollowupViewModel(records, { workspaceId, today });
}
