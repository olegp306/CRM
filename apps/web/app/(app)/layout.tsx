import { AppChrome } from "@/components/app-chrome";
import { WorkspaceSessionProvider } from "@/components/workspace-session-provider";
import { assertDeploymentDatabaseIsolation, currentAppChangelog, currentAppMetadata, resolveDeploymentEnvironment } from "@app/core";
import { createWorkspaceThemeStyle } from "@app/ui";
import { getWorkspaceSession } from "../workspace-session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  assertDeploymentDatabaseIsolation(process.env);
  const session = await getWorkspaceSession();

  return (
    <WorkspaceSessionProvider session={session}>
      <AppChrome
        primaryStyle={createWorkspaceThemeStyle({ primaryColor: session.primaryColor, themePreference: session.themePreference })}
        workspaceName={session.workspaceName}
        userName={session.userName}
        appVersion={currentAppMetadata.version}
        deploymentEnvironment={resolveDeploymentEnvironment(process.env)}
        changelog={currentAppChangelog}
      >
        {children}
      </AppChrome>
    </WorkspaceSessionProvider>
  );
}
