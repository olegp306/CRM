import { exportPlatformAuditCsvAction } from "@/app/(app)/assistant/actions";
import { getWorkspaceSession } from "@/app/workspace-session";
import { parsePlatformAuditFilters } from "../filters";

export async function GET(request: Request) {
  const session = await getWorkspaceSession();
  const url = new URL(request.url);
  const csv = await exportPlatformAuditCsvAction(session.workspaceId, {
    ...parsePlatformAuditFilters({
      action: url.searchParams.get("action") ?? undefined,
      actor: url.searchParams.get("actor") ?? undefined,
      q: url.searchParams.get("q") ?? undefined
    })
  });

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"platform-audit.csv\""
    }
  });
}
