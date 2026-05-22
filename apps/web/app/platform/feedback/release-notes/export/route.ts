import { getAssistantRepository } from "@/app/(app)/assistant/repository";
import { getWorkspaceSession } from "@/app/workspace-session";
import { createPlatformReleaseNotesDraft, createPlatformReleaseNotesMarkdown } from "@app/assistant";
import { currentAppMetadata } from "@app/core";

export async function GET(request: Request) {
  const session = await getWorkspaceSession();
  const url = new URL(request.url);
  const appVersion = url.searchParams.get("appVersion") ?? currentAppMetadata.version;
  const feedback = await getAssistantRepository().listFeedback(session.workspaceId);
  const markdown = createPlatformReleaseNotesMarkdown(createPlatformReleaseNotesDraft(appVersion, feedback));

  return new Response(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="release-notes-v${appVersion}.md"`
    }
  });
}
