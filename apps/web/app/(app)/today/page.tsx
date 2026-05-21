import { getWorkspaceSession } from "../../workspace-session";
import { listTodayFollowups } from "./today-store";

export default async function TodayPage() {
  const session = await getWorkspaceSession();
  const followups = await listTodayFollowups(session.workspaceId);

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Today</h1>
        <p className="text-sm text-muted-foreground">Due follow-ups and time-sensitive L01 lead intake work.</p>
      </div>

      <div className="rounded-lg border border-border bg-white p-4">
        <h2 className="text-base font-semibold">Due follow-ups</h2>
        {followups.length > 0 ? (
          <div className="mt-3 grid gap-3">
            {followups.map((followup) => (
              <article key={followup.id} className="grid gap-1 border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-foreground">{followup.followupId}</p>
                  <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                    Due {followup.dueDateLabel}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{followup.rawInput}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No due follow-ups for today.</p>
        )}
      </div>
    </section>
  );
}
