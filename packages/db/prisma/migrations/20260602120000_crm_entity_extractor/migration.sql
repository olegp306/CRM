ALTER TABLE "Lead" ADD COLUMN "displayName" TEXT;
ALTER TABLE "Lead" ADD COLUMN "language" TEXT;
ALTER TABLE "Lead" ADD COLUMN "country" TEXT;
ALTER TABLE "Lead" ADD COLUMN "searchTags" JSONB;

CREATE TABLE "LeadContextEntity" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "leadRecordId" TEXT NOT NULL,
  "sourceChannel" TEXT NOT NULL,
  "sourceMessageId" TEXT,
  "entityType" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "normalizedKey" TEXT,
  "sourceText" TEXT,
  "confidence" TEXT NOT NULL,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadContextEntity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmCalendarAction" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "leadRecordId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "dueAt" TIMESTAMP(3),
  "recurrence" TEXT,
  "status" TEXT NOT NULL DEFAULT 'planned',
  "sourceChannel" TEXT,
  "sourceMessageId" TEXT,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmCalendarAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadContextEntity_workspaceId_entityType_idx" ON "LeadContextEntity"("workspaceId", "entityType");
CREATE INDEX "LeadContextEntity_leadRecordId_createdAt_idx" ON "LeadContextEntity"("leadRecordId", "createdAt");
CREATE INDEX "LeadContextEntity_workspaceId_normalizedKey_idx" ON "LeadContextEntity"("workspaceId", "normalizedKey");
CREATE INDEX "CrmCalendarAction_workspaceId_status_dueAt_idx" ON "CrmCalendarAction"("workspaceId", "status", "dueAt");
CREATE INDEX "CrmCalendarAction_leadRecordId_createdAt_idx" ON "CrmCalendarAction"("leadRecordId", "createdAt");

ALTER TABLE "LeadContextEntity" ADD CONSTRAINT "LeadContextEntity_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeadContextEntity" ADD CONSTRAINT "LeadContextEntity_leadRecordId_fkey"
  FOREIGN KEY ("leadRecordId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CrmCalendarAction" ADD CONSTRAINT "CrmCalendarAction_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CrmCalendarAction" ADD CONSTRAINT "CrmCalendarAction_leadRecordId_fkey"
  FOREIGN KEY ("leadRecordId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
