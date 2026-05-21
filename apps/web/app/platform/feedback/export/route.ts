import { exportPlatformFeedbackCsvAction } from "@/app/(app)/assistant/actions";
import { getWorkspaceSession } from "@/app/workspace-session";
import { parsePlatformFeedbackFilters } from "../filters";

export async function GET(request: Request) {
  const session = await getWorkspaceSession();
  const url = new URL(request.url);
  const csv = await exportPlatformFeedbackCsvAction(session.workspaceId, {
    ...parsePlatformFeedbackFilters({
      status: url.searchParams.get("status") ?? undefined,
      type: url.searchParams.get("type") ?? undefined
    })
  });

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"platform-feedback.csv\""
    }
  });
}
