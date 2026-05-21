import { AppChrome } from "@/components/app-chrome";
import { WorkspaceSessionProvider } from "@/components/workspace-session-provider";
import { createWorkspaceThemeStyle } from "@app/ui";
import { getWorkspaceSession } from "../workspace-session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getWorkspaceSession();

  return (
    <WorkspaceSessionProvider session={session}>
      <AppChrome
        primaryStyle={createWorkspaceThemeStyle({ primaryColor: session.primaryColor })}
        workspaceName={session.workspaceName}
        workspaceDescription={session.workspaceDescription}
        userName={session.userName}
      >
        {children}
      </AppChrome>
    </WorkspaceSessionProvider>
  );
}
