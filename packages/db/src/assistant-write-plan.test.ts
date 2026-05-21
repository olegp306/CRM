import { describe, expect, it } from "vitest";
import type { AssistantContext } from "@app/assistant";
import { createAssistantPersistenceDraft, createAssistantSubmissionResult } from "@app/assistant";
import { createAssistantPrismaWritePlan } from "./assistant-write-plan";

const context: AssistantContext = {
  workspaceId: "workspace-1",
  userId: "user-1",
  role: "admin",
  route: "/leads",
  module: "leads",
  selectedRecordIds: ["lead-1"]
};

function createDraft(content: string, threadId = "thread-1", messageId = "message-1") {
  return createAssistantPersistenceDraft(
    createAssistantSubmissionResult({
      context,
      content,
      threadId,
      messageId
    }),
    { threadId, messageId }
  );
}

describe("assistant Prisma write plan", () => {
  it("maps thread upsert and message create input", () => {
    const plan = createAssistantPrismaWritePlan(createDraft("Please add mobile filters"));

    expect(plan.threadUpsert).toEqual({
      where: { id: "thread-1" },
      create: {
        id: "thread-1",
        workspaceId: "workspace-1",
        createdByUserId: "user-1",
        title: "Please add mobile filters"
      },
      update: {
        title: "Please add mobile filters"
      }
    });
    expect(plan.messageCreate).toMatchObject({
      id: "message-1",
      threadId: "thread-1",
      userId: "user-1",
      role: "user",
      content: "Please add mobile filters",
      intent: "feature_request"
    });
  });

  it("maps feedback create input when feedback exists", () => {
    const plan = createAssistantPrismaWritePlan(createDraft("Please add mobile filters"));

    expect(plan.feedbackCreate).toEqual({
      workspaceId: "workspace-1",
      sourceThreadId: "thread-1",
      sourceMessageId: "message-1",
      type: "feature_request",
      status: "new",
      priority: "normal",
      moduleContext: "leads"
    });
  });

  it("maps action and audit create inputs when action preview exists", () => {
    const plan = createAssistantPrismaWritePlan(createDraft("Create lead Anna Beispiel"));

    expect(plan.actionCreate).toMatchObject({
      workspaceId: "workspace-1",
      threadId: "thread-1",
      messageId: "message-1",
      actionType: "create_lead",
      status: "awaiting_confirmation",
      requestedByUserId: "user-1"
    });
    expect(plan.auditCreateManyData.map((event) => event.action)).toEqual([
      "assistant.message.submitted",
      "assistant.action.preview_created"
    ]);
  });
});
