ALTER TABLE "FeedbackItem" ADD COLUMN "appVersion" TEXT;

CREATE INDEX "FeedbackItem_workspaceId_appVersion_idx" ON "FeedbackItem"("workspaceId", "appVersion");
