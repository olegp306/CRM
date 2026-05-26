import { resolveWorkspaceSession, type WorkspaceSessionContext, type WorkspaceSessionSource } from "@app/auth";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, isGoogleAdminAuthConfigured, isSessionAllowed } from "@/auth";

const cookieKeys: Record<keyof WorkspaceSessionContext, string> = {
  workspaceId: "crm_workspace_id",
  workspaceName: "crm_workspace_name",
  workspaceDescription: "crm_workspace_description",
  userId: "crm_user_id",
  userName: "crm_user_name",
  role: "crm_workspace_role",
  primaryColor: "crm_primary_color",
  themePreference: "crm_theme_preference"
};

const headerKeys: Record<keyof WorkspaceSessionContext, string> = {
  workspaceId: "x-crm-workspace-id",
  workspaceName: "x-crm-workspace-name",
  workspaceDescription: "x-crm-workspace-description",
  userId: "x-crm-user-id",
  userName: "x-crm-user-name",
  role: "x-crm-workspace-role",
  primaryColor: "x-crm-primary-color",
  themePreference: "x-crm-theme-preference"
};

export async function getWorkspaceSession(): Promise<WorkspaceSessionContext> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const source = Object.fromEntries(
    (Object.keys(cookieKeys) as Array<keyof WorkspaceSessionContext>).map((key) => [
      key,
      cookieStore.get(cookieKeys[key])?.value ?? headerStore.get(headerKeys[key]) ?? undefined
    ])
  ) as WorkspaceSessionSource;

  const workspaceSession = resolveWorkspaceSession(source);

  if (!isGoogleAdminAuthConfigured()) {
    return workspaceSession;
  }

  const googleSession = await getServerSession(authOptions);
  if (!googleSession?.user?.email) {
    redirect("/login");
  }

  if (!isSessionAllowed(googleSession)) {
    redirect("/access-denied");
  }

  return {
    ...workspaceSession,
    userId: `google:${googleSession.user.email.toLowerCase()}`,
    userName: googleSession.user.name ?? googleSession.user.email,
    role: "admin"
  };
}
