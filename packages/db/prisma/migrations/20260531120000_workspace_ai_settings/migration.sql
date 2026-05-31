CREATE TABLE "WorkspaceAiSetting" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceAiSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceAiSetting_workspaceId_role_key" ON "WorkspaceAiSetting"("workspaceId", "role");
CREATE INDEX "WorkspaceAiSetting_workspaceId_idx" ON "WorkspaceAiSetting"("workspaceId");

ALTER TABLE "WorkspaceAiSetting" ADD CONSTRAINT "WorkspaceAiSetting_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
