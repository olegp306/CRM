export type FollowupStatus = "pending" | "done" | "skipped";

export type FollowupListItem = {
  id: string;
  workspaceId: string;
  followupId: string;
  dueDate: Date;
  status: FollowupStatus;
  rawInput: string;
  requestedByUserId: string;
};

export type DueFollowupFilters = {
  workspaceId: string;
  today: Date;
};

export function getDueFollowups(items: FollowupListItem[], filters: DueFollowupFilters): FollowupListItem[] {
  const todayEnd = endOfUtcDay(filters.today);

  return items
    .filter((item) => item.workspaceId === filters.workspaceId)
    .filter((item) => item.status === "pending")
    .filter((item) => item.dueDate.getTime() <= todayEnd.getTime())
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

export function parseFollowupIdDueDate(followupId: string): Date | null {
  const match = /^F-(\d{8})-/.exec(followupId);

  if (!match) {
    return null;
  }

  const value = match[1];
  return new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00.000Z`);
}

function endOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}
