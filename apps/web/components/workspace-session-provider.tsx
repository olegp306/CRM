"use client";

import type { WorkspaceSessionContext } from "@app/auth";
import { createContext, useContext } from "react";

const WorkspaceSessionContextValue = createContext<WorkspaceSessionContext | null>(null);

export function WorkspaceSessionProvider({
  children,
  session
}: {
  children: React.ReactNode;
  session: WorkspaceSessionContext;
}) {
  return <WorkspaceSessionContextValue.Provider value={session}>{children}</WorkspaceSessionContextValue.Provider>;
}

export function useWorkspaceSession() {
  const session = useContext(WorkspaceSessionContextValue);

  if (!session) {
    throw new Error("useWorkspaceSession must be used inside WorkspaceSessionProvider");
  }

  return session;
}
