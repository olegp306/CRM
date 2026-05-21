import { exportPlatformReleaseHistoryCsvAction } from "@/app/(app)/assistant/actions";
import { getWorkspaceSession } from "@/app/workspace-session";

export async function GET() {
  const session = await getWorkspaceSession();
  const csv = await exportPlatformReleaseHistoryCsvAction(session.workspaceId);

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"release-history.csv\""
    }
  });
}
