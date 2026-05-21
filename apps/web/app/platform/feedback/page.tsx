import { getPlatformInboxSummaryAction } from "@/app/(app)/assistant/actions";
import { getWorkspaceSession } from "@/app/workspace-session";
import { currentAppMetadata } from "@app/core";
import { FeedbackBulkControls } from "./feedback-bulk-controls";
import { FeedbackTriageControls } from "./feedback-triage-controls";
import { parsePlatformFeedbackFilters, type PlatformFeedbackSearchParams } from "./filters";

const statusFilters = ["new", "triaged", "planned", "transferred", "declined", "archived"] as const;
const typeFilters = ["support_request", "bug_report", "feature_request", "ux_feedback", "permission_blocked"] as const;

export default async function PlatformFeedbackPage({
  searchParams
}: {
  searchParams?: Promise<PlatformFeedbackSearchParams>;
}) {
  const session = await getWorkspaceSession();
  const filters = parsePlatformFeedbackFilters((await searchParams) ?? {});
  const inbox = await getPlatformInboxSummaryAction(session.workspaceId, filters);
  const feedbackTypes = Object.entries(inbox.feedbackByType);
  const versionFilters = Array.from(
    new Set([currentAppMetadata.version, ...inbox.rows.map((row) => row.appVersion).filter((version) => version !== "unknown")])
  );

  return (
    <section className="grid gap-4">
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Global Feedback Inbox</h2>
            <p className="mt-2 text-sm text-neutral-400">
              Assistant messages across workspaces are classified here for support, bugs, feature requests, UX feedback, and pending action previews.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <Metric label="Open" value={inbox.openCount} />
            <Metric label="Feedback" value={inbox.feedbackCount} />
            <Metric label="Actions" value={inbox.actionCount} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <h3 className="text-sm font-semibold">Feedback types</h3>
          <div className="mt-3 grid gap-2 text-sm">
            <a href="/platform/feedback" className="rounded-lg border border-neutral-800 px-3 py-2 text-neutral-300">
              All feedback
            </a>
            <a
              href={`/platform/feedback/export?${new URLSearchParams(filters).toString()}`}
              className="rounded-lg border border-neutral-700 px-3 py-2 font-semibold text-neutral-100"
            >
              Export CSV
            </a>
            {statusFilters.map((status) => (
                <a
                  key={status}
                  href={buildFeedbackHref({ ...filters, status })}
                  className={`rounded-lg border px-3 py-2 ${filters.status === status ? "border-neutral-500 bg-neutral-800 text-white" : "border-neutral-800 text-neutral-300"}`}
                >
                {status}
              </a>
            ))}
          </div>

          <h3 className="mt-5 text-sm font-semibold">Signal types</h3>
          <div className="mt-3 grid gap-2 text-sm">
            {typeFilters.map((type) => (
                <a
                  key={type}
                  href={buildFeedbackHref({ ...filters, type })}
                  className={`rounded-lg border px-3 py-2 ${filters.type === type ? "border-neutral-500 bg-neutral-800 text-white" : "border-neutral-800 text-neutral-300"}`}
                >
                {type}
              </a>
            ))}
          </div>

          <h3 className="mt-5 text-sm font-semibold">Version</h3>
          <div className="mt-3 grid gap-2 text-sm">
            {versionFilters.map((appVersion) => (
              <a
                key={appVersion}
                href={buildFeedbackHref({ ...filters, appVersion })}
                className={`rounded-lg border px-3 py-2 ${filters.appVersion === appVersion ? "border-neutral-500 bg-neutral-800 text-white" : "border-neutral-800 text-neutral-300"}`}
              >
                v{appVersion}
              </a>
            ))}
          </div>

          <h3 className="mt-5 text-sm font-semibold">Bulk actions</h3>
          <div className="mt-3">
            <FeedbackBulkControls workspaceId={session.workspaceId} filters={filters} />
          </div>

          <h3 className="mt-5 text-sm font-semibold">Current counts</h3>
          <div className="mt-3 grid gap-2 text-sm">
            {feedbackTypes.length > 0 ? (
              feedbackTypes.map(([type, count]) => (
                <div key={type} className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-2">
                  <span className="text-neutral-300">{type}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-neutral-500">No feedback captured yet.</p>
            )}
          </div>
        </aside>

        <div className="grid gap-4">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900">
            <div className="border-b border-neutral-800 px-4 py-3">
              <h3 className="text-sm font-semibold">Release triage</h3>
            </div>
            <div className="grid gap-2 p-4 text-sm md:grid-cols-2 xl:grid-cols-3">
              {inbox.releaseTriage.length > 0 ? (
                inbox.releaseTriage.map((release) => (
                  <a
                    key={release.appVersion}
                    href={buildFeedbackHref({ ...filters, appVersion: release.appVersion })}
                    className={`rounded-lg border px-3 py-2 ${filters.appVersion === release.appVersion ? "border-neutral-500 bg-neutral-800 text-white" : "border-neutral-800 text-neutral-300"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">v{release.appVersion}</span>
                      <span className="text-xs text-neutral-500">{release.openCount} open</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-500">
                      <span>{release.totalCount} total</span>
                      <span>{release.byType.feature_request ?? 0} feature</span>
                      <span>{release.byType.bug_report ?? 0} bugs</span>
                    </div>
                  </a>
                ))
              ) : (
                <p className="text-sm text-neutral-500">No versioned feedback captured yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900">
            <div className="border-b border-neutral-800 px-4 py-3">
              <h3 className="text-sm font-semibold">Queue</h3>
            </div>
            <div className="divide-y divide-neutral-800">
              {inbox.rows.length > 0 ? (
                inbox.rows.map((row) => (
                  <div key={row.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[120px_minmax(0,1fr)_120px_90px_110px_220px] md:items-center">
                    <span className="w-fit rounded-md border border-neutral-700 px-2 py-1 text-xs font-semibold uppercase text-neutral-300">{row.kind}</span>
                    <span className="font-medium">{row.label}</span>
                    <span className="text-neutral-400">{row.moduleContext}</span>
                    <span className="text-xs font-semibold text-neutral-500">v{row.appVersion}</span>
                    <span className="text-neutral-400">{row.status}</span>
                    {row.kind === "feedback" ? (
                      <FeedbackTriageControls workspaceId={session.workspaceId} sourceMessageId={row.sourceMessageId} />
                    ) : (
                      <span className="text-xs text-neutral-600">Action preview</span>
                    )}
                  </div>
                ))
              ) : (
                <p className="px-4 py-10 text-center text-sm text-neutral-500">
                  Submit assistant feedback or an action preview from the app shell to populate this queue.
                </p>
              )}
            </div>
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

function buildFeedbackHref(filters: { status?: string; type?: string; appVersion?: string }) {
  const params = new URLSearchParams({
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.appVersion ? { appVersion: filters.appVersion } : {})
  });

  const query = params.toString();
  return query ? `/platform/feedback?${query}` : "/platform/feedback";
}
