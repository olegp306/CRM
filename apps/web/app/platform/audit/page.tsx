import { getPlatformAuditReviewAction } from "@/app/(app)/assistant/actions";
import { getWorkspaceSession } from "@/app/workspace-session";
import { parsePlatformAuditFilters, type PlatformAuditSearchParams } from "./filters";

const actionFilters = ["assistant.message.submitted", "assistant.action.preview_created", "assistant.action.executed"] as const;

export default async function PlatformAuditPage({
  searchParams
}: {
  searchParams?: Promise<PlatformAuditSearchParams>;
}) {
  const session = await getWorkspaceSession();
  const filters = parsePlatformAuditFilters((await searchParams) ?? {});
  const review = await getPlatformAuditReviewAction(session.workspaceId, filters);
  const events = review.events;
  const exportParams = new URLSearchParams({
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.actorUserId ? { actor: filters.actorUserId } : {}),
    ...(filters.query ? { q: filters.query } : {})
  });

  return (
    <section className="grid gap-4">
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Audit Log</h2>
            <p className="mt-2 text-sm text-neutral-400">Platform admin reads and sensitive assistant actions are recorded here.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center text-sm md:grid-cols-4">
            <Metric label="Events" value={review.summary.totalCount} />
            <Metric label="Executed" value={review.summary.executedActionCount} />
            <Metric label="Previews" value={review.summary.actionCounts["assistant.action.preview_created"]} />
            <Metric label="Messages" value={review.summary.actionCounts["assistant.message.submitted"]} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <h3 className="text-sm font-semibold">Review filters</h3>
          <div className="mt-3 grid gap-2 text-sm">
            <a href="/platform/audit" className="rounded-lg border border-neutral-800 px-3 py-2 text-neutral-300">
              All audit events
            </a>
            <a
              href={`/platform/audit/export?${exportParams.toString()}`}
              className="rounded-lg border border-neutral-700 px-3 py-2 font-semibold text-neutral-100"
            >
              Export CSV
            </a>
            {actionFilters.map((action) => (
              <a
                key={action}
                href={`/platform/audit?action=${action}${filters.actorUserId ? `&actor=${filters.actorUserId}` : ""}${filters.query ? `&q=${filters.query}` : ""}`}
                className={`rounded-lg border px-3 py-2 ${filters.action === action ? "border-neutral-500 bg-neutral-800 text-white" : "border-neutral-800 text-neutral-300"}`}
              >
                {action.replace("assistant.", "")}
              </a>
            ))}
          </div>

          <h3 className="mt-5 text-sm font-semibold">Actors</h3>
          <div className="mt-3 grid gap-2 text-sm">
            {Object.entries(review.summary.actorCounts).length > 0 ? (
              Object.entries(review.summary.actorCounts).map(([actor, count]) => (
                <a
                  key={actor}
                  href={`/platform/audit?actor=${actor}${filters.action ? `&action=${filters.action}` : ""}${filters.query ? `&q=${filters.query}` : ""}`}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 ${filters.actorUserId === actor ? "border-neutral-500 bg-neutral-800 text-white" : "border-neutral-800 text-neutral-300"}`}
                >
                  <span>{actor}</span>
                  <span className="font-semibold">{count}</span>
                </a>
              ))
            ) : (
              <p className="text-sm text-neutral-500">No actors yet.</p>
            )}
          </div>
        </aside>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900">
          <div className="border-b border-neutral-800 px-4 py-3">
            <h3 className="text-sm font-semibold">Assistant events</h3>
          </div>
          <div className="divide-y divide-neutral-800">
            {events.length > 0 ? (
              events.map((event, index) => (
                <div key={`${event.action}-${event.targetId}-${index}`} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_160px_160px] md:items-center">
                  <div>
                    <p className="font-medium">{event.action}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {event.targetType} {event.targetId}
                    </p>
                  </div>
                  <span className="text-neutral-400">{event.actorUserId ?? "system"}</span>
                  <span className="text-neutral-400">{String(event.metadata.moduleContext ?? event.metadata.actionType ?? "assistant")}</span>
                </div>
              ))
            ) : (
              <p className="px-4 py-10 text-center text-sm text-neutral-500">
                Submit assistant messages or action previews to populate the audit trail.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-20 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}
