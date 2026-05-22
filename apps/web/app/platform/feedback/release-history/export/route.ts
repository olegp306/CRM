import { exportPlatformReleaseHistoryCsvAction } from "@/app/(app)/assistant/actions";
import { getWorkspaceSession } from "@/app/workspace-session";

export async function GET(request: Request) {
  const session = await getWorkspaceSession();
  const url = new URL(request.url);
  const csv = await exportPlatformReleaseHistoryCsvAction(session.workspaceId, {
    appVersion: url.searchParams.get("appVersion") ?? undefined
  });

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"release-history.csv\""
    }
  });
}
