-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('owner', 'admin', 'manager', 'member', 'viewer');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('platform_admin');

-- CreateEnum
CREATE TYPE "AssistantIntent" AS ENUM ('crm_action', 'support_request', 'bug_report', 'feature_request', 'ux_feedback', 'business_process_note', 'permission_blocked', 'other');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('new', 'triaged', 'planned', 'transferred', 'declined', 'archived');

-- CreateEnum
CREATE TYPE "AttachmentStatus" AS ENUM ('draft', 'in_review', 'approved', 'sent', 'signed', 'current', 'obsolete', 'archived');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandName" TEXT,
    "logoAttachmentId" TEXT,
    "primaryColor" TEXT,
    "plan" TEXT,
    "subscriptionStatus" TEXT,
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "imageUrl" TEXT,
    "platformRole" "PlatformRole",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMembership" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "token" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "clientType" TEXT NOT NULL,
    "language" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "source" TEXT,
    "referredBy" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "clientRecordId" TEXT,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "temperature" TEXT,
    "requestType" TEXT,
    "urgency" TEXT,
    "budgetEur" DECIMAL(65,30),
    "desiredStart" TIMESTAMP(3),
    "desiredMoveIn" TIMESTAMP(3),
    "bgfM2" DECIMAL(65,30),
    "wohnflaecheM2" DECIMAL(65,30),
    "projectAddress" TEXT,
    "isStandard" BOOLEAN,
    "status" TEXT NOT NULL,
    "rawInput" TEXT,
    "missingData" JSONB,
    "kpGeneratedDocumentId" TEXT,
    "kpSentDate" TIMESTAMP(3),
    "followup1Date" TIMESTAMP(3),
    "followupStatus" TEXT,
    "outcome" TEXT,
    "outcomeReason" TEXT,
    "projectRecordId" TEXT,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clientRecordId" TEXT,
    "leadRecordId" TEXT,
    "projectName" TEXT NOT NULL,
    "projectAddress" TEXT,
    "cadastralNr" TEXT,
    "bgfM2" DECIMAL(65,30),
    "wohnflaecheM2" DECIMAL(65,30),
    "projectType" TEXT,
    "lphScope" TEXT,
    "hasBauvoranfrage" BOOLEAN NOT NULL DEFAULT false,
    "hasDenkmalschutz" BOOLEAN NOT NULL DEFAULT false,
    "hasBefreiung" BOOLEAN NOT NULL DEFAULT false,
    "totalNetEur" DECIMAL(65,30),
    "totalGrossEur" DECIMAL(65,30),
    "contractDate" TIMESTAMP(3),
    "contractGeneratedDocumentId" TEXT,
    "milestone1Status" TEXT,
    "milestone2Status" TEXT,
    "milestone3Status" TEXT,
    "currentPhase" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPhase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',

    CONSTRAINT "ProjectPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phaseId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "assigneeUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "blockedByTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectChecklistItem" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "ProjectChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDecision" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "decisionText" TEXT NOT NULL,
    "context" TEXT,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "source" TEXT NOT NULL,
    "decidedByUserId" TEXT,
    "decisionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "relatedPhase" TEXT,
    "relatedTaskId" TEXT,
    "supersedesDecisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceTableRow" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "bgfFromM2" INTEGER NOT NULL,
    "bgfToM2" INTEGER NOT NULL,
    "netEur" DECIMAL(65,30) NOT NULL,
    "grossEur" DECIMAL(65,30) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceTableRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColdTarget" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "targetId" TEXT,
    "clientRecordId" TEXT,
    "leadRecordId" TEXT,
    "companyName" TEXT NOT NULL,
    "website" TEXT,
    "region" TEXT,
    "address" TEXT,
    "contactPerson" TEXT,
    "contactRole" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "fitScore" INTEGER,
    "priority" TEXT,
    "notesResearch" TEXT,
    "currentTouch" INTEGER,
    "nextActionDate" TIMESTAMP(3),
    "nextActionType" TEXT,
    "lastTouchDate" TIMESTAMP(3),
    "lastResponse" TEXT,
    "outcome" TEXT,
    "nextReviewDate" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ColdTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachTouch" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "coldTargetId" TEXT NOT NULL,
    "touchNumber" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachTouch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentCase" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "caseType" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentDraft" (
    "id" TEXT NOT NULL,
    "contentCaseId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPublication" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contentCaseId" TEXT NOT NULL,
    "draftId" TEXT,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "externalUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentPublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "AttachmentStatus" NOT NULL DEFAULT 'draft',
    "source" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "detectedPlaceholders" JSONB NOT NULL,
    "unknownPlaceholders" JSONB NOT NULL,
    "validationStatus" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeNote" TEXT,

    CONSTRAINT "DocumentTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedDocument" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "docxAttachmentId" TEXT,
    "pdfAttachmentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "inputSnapshot" JSONB NOT NULL,
    "warnings" JSONB,
    "generatedByUserId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantThread" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "intent" "AssistantIntent",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantAction" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "messageId" TEXT,
    "actionType" TEXT NOT NULL,
    "preview" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB,
    "requestedByUserId" TEXT NOT NULL,
    "confirmedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "AssistantAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceThreadId" TEXT NOT NULL,
    "sourceMessageId" TEXT NOT NULL,
    "type" "AssistantIntent" NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'new',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "moduleContext" TEXT,
    "internalNotes" TEXT,
    "externalTaskUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationAccount" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "connectedByUserId" TEXT NOT NULL,
    "encryptedTokens" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Workspace_createdAt_idx" ON "Workspace"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "WorkspaceMembership_workspaceId_role_idx" ON "WorkspaceMembership"("workspaceId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMembership_userId_key" ON "WorkspaceMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMembership_workspaceId_userId_key" ON "WorkspaceMembership"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");

-- CreateIndex
CREATE INDEX "Invite_workspaceId_email_idx" ON "Invite"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "Invite_expiresAt_idx" ON "Invite"("expiresAt");

-- CreateIndex
CREATE INDEX "Client_workspaceId_status_idx" ON "Client"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Client_workspaceId_createdDate_idx" ON "Client"("workspaceId", "createdDate");

-- CreateIndex
CREATE UNIQUE INDEX "Client_workspaceId_clientId_key" ON "Client"("workspaceId", "clientId");

-- CreateIndex
CREATE INDEX "Lead_workspaceId_status_idx" ON "Lead"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Lead_workspaceId_followup1Date_idx" ON "Lead"("workspaceId", "followup1Date");

-- CreateIndex
CREATE INDEX "Lead_clientRecordId_idx" ON "Lead"("clientRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_workspaceId_leadId_key" ON "Lead"("workspaceId", "leadId");

-- CreateIndex
CREATE INDEX "Project_workspaceId_status_idx" ON "Project"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Project_workspaceId_currentPhase_idx" ON "Project"("workspaceId", "currentPhase");

-- CreateIndex
CREATE UNIQUE INDEX "Project_workspaceId_projectId_key" ON "Project"("workspaceId", "projectId");

-- CreateIndex
CREATE INDEX "ProjectPhase_projectId_sortOrder_idx" ON "ProjectPhase"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProjectTask_projectId_status_idx" ON "ProjectTask"("projectId", "status");

-- CreateIndex
CREATE INDEX "ProjectTask_assigneeUserId_idx" ON "ProjectTask"("assigneeUserId");

-- CreateIndex
CREATE INDEX "ProjectTask_dueDate_idx" ON "ProjectTask"("dueDate");

-- CreateIndex
CREATE INDEX "ProjectChecklistItem_taskId_sortOrder_idx" ON "ProjectChecklistItem"("taskId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProjectDecision_projectId_decisionDate_idx" ON "ProjectDecision"("projectId", "decisionDate");

-- CreateIndex
CREATE INDEX "PriceTableRow_workspaceId_isActive_idx" ON "PriceTableRow"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "ColdTarget_workspaceId_nextActionDate_idx" ON "ColdTarget"("workspaceId", "nextActionDate");

-- CreateIndex
CREATE INDEX "ColdTarget_workspaceId_outcome_idx" ON "ColdTarget"("workspaceId", "outcome");

-- CreateIndex
CREATE INDEX "OutreachTouch_workspaceId_status_idx" ON "OutreachTouch"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "OutreachTouch_coldTargetId_touchNumber_idx" ON "OutreachTouch"("coldTargetId", "touchNumber");

-- CreateIndex
CREATE INDEX "ContentCase_workspaceId_status_idx" ON "ContentCase"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "ContentDraft_contentCaseId_channel_idx" ON "ContentDraft"("contentCaseId", "channel");

-- CreateIndex
CREATE INDEX "ContentDraft_status_idx" ON "ContentDraft"("status");

-- CreateIndex
CREATE INDEX "ContentPublication_workspaceId_status_idx" ON "ContentPublication"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "ContentPublication_publishedAt_idx" ON "ContentPublication"("publishedAt");

-- CreateIndex
CREATE INDEX "Attachment_workspaceId_status_idx" ON "Attachment"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "DocumentTemplate_workspaceId_documentType_idx" ON "DocumentTemplate"("workspaceId", "documentType");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplateVersion_templateId_version_key" ON "DocumentTemplateVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "GeneratedDocument_workspaceId_sourceType_sourceId_idx" ON "GeneratedDocument"("workspaceId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "AssistantThread_workspaceId_updatedAt_idx" ON "AssistantThread"("workspaceId", "updatedAt");

-- CreateIndex
CREATE INDEX "AssistantMessage_threadId_createdAt_idx" ON "AssistantMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "AssistantMessage_intent_idx" ON "AssistantMessage"("intent");

-- CreateIndex
CREATE INDEX "AssistantAction_workspaceId_status_idx" ON "AssistantAction"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "AssistantAction_threadId_idx" ON "AssistantAction"("threadId");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantAction_workspaceId_messageId_key" ON "AssistantAction"("workspaceId", "messageId");

-- CreateIndex
CREATE INDEX "FeedbackItem_workspaceId_status_idx" ON "FeedbackItem"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "FeedbackItem_workspaceId_type_idx" ON "FeedbackItem"("workspaceId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackItem_sourceThreadId_sourceMessageId_key" ON "FeedbackItem"("sourceThreadId", "sourceMessageId");

-- CreateIndex
CREATE INDEX "AuditLog_workspaceId_createdAt_idx" ON "AuditLog"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationAccount_workspaceId_provider_key" ON "IntegrationAccount"("workspaceId", "provider");

-- AddForeignKey
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_clientRecordId_fkey" FOREIGN KEY ("clientRecordId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientRecordId_fkey" FOREIGN KEY ("clientRecordId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPhase" ADD CONSTRAINT "ProjectPhase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChecklistItem" ADD CONSTRAINT "ProjectChecklistItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDecision" ADD CONSTRAINT "ProjectDecision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceTableRow" ADD CONSTRAINT "PriceTableRow_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdTarget" ADD CONSTRAINT "ColdTarget_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachTouch" ADD CONSTRAINT "OutreachTouch_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachTouch" ADD CONSTRAINT "OutreachTouch_coldTargetId_fkey" FOREIGN KEY ("coldTargetId") REFERENCES "ColdTarget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentCase" ADD CONSTRAINT "ContentCase_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentDraft" ADD CONSTRAINT "ContentDraft_contentCaseId_fkey" FOREIGN KEY ("contentCaseId") REFERENCES "ContentCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPublication" ADD CONSTRAINT "ContentPublication_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPublication" ADD CONSTRAINT "ContentPublication_contentCaseId_fkey" FOREIGN KEY ("contentCaseId") REFERENCES "ContentCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPublication" ADD CONSTRAINT "ContentPublication_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ContentDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplateVersion" ADD CONSTRAINT "DocumentTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantThread" ADD CONSTRAINT "AssistantThread_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AssistantThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantAction" ADD CONSTRAINT "AssistantAction_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackItem" ADD CONSTRAINT "FeedbackItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationAccount" ADD CONSTRAINT "IntegrationAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

