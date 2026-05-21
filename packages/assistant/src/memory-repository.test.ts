import { describe, expect, it } from "vitest";
import type { AssistantContext } from "./context";
import { createPlatformReleasePlanningAuditEvent } from "./audit-log";
import { createAssistantMemoryRepository } from "./memory-repository";
import { createAssistantPersistenceDraft } from "./persistence";
import { createAssistantSubmissionResult } from "./submission";

const context: AssistantContext = {
  workspaceId: "workspace-1",
  userId: "user-1",
  role: "admin",
  route: "/assistant",
  module: "assistant",
  selectedRecordIds: []
};

function createDraft(content: string, threadId: string, messageId: string) {
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

describe("assistant memory repository", () => {
  it("saves thread and message drafts", () => {
    const repository = createAssistantMemoryRepository();

    repository.save(createDraft("Hello assistant", "thread-1", "message-1"));

    expect(repository.listThreads("workspace-1")).toEqual([
      expect.objectContaining({ id: "thread-1", workspaceId: "workspace-1" })
    ]);
    expect(repository.listMessages("thread-1")).toEqual([
      expect.objectContaining({ id: "message-1", content: "Hello assistant" })
    ]);
  });

  it("upserts threads and appends messages for the same thread", () => {
    const repository = createAssistantMemoryRepository();

    repository.save(createDraft("First", "thread-1", "message-1"));
    repository.save(createDraft("Second", "thread-1", "message-2"));

    expect(repository.listThreads("workspace-1")).toHaveLength(1);
    expect(repository.listMessages("thread-1").map((message) => message.content)).toEqual(["First", "Second"]);
  });

  it("stores feedback and action drafts separately", () => {
    const repository = createAssistantMemoryRepository();

    repository.save(createDraft("Please add mobile filters", "thread-1", "message-1"));
    repository.save(createDraft("Create lead Anna Beispiel", "thread-1", "message-2"));

    expect(repository.listFeedback("workspace-1")).toEqual([
      expect.objectContaining({ type: "feature_request", sourceMessageId: "message-1" })
    ]);
    expect(repository.listActions("workspace-1")).toEqual([
      expect.objectContaining({ actionType: "create_lead", messageId: "message-2" })
    ]);
  });

  it("stores audit events for saved submissions", () => {
    const repository = createAssistantMemoryRepository();

    repository.save(createDraft("Create lead Anna Beispiel", "thread-1", "message-1"));

    expect(repository.listAuditEvents("workspace-1").map((event) => event.action)).toEqual([
      "assistant.message.submitted",
      "assistant.action.preview_created"
    ]);
  });

  it("updates feedback status by source message id", () => {
    const repository = createAssistantMemoryRepository();

    repository.save(createDraft("Please add mobile filters", "thread-1", "message-1"));
    const updated = repository.updateFeedbackStatus("workspace-1", "message-1", "triage");

    expect(updated?.status).toBe("triaged");
    expect(repository.listFeedback("workspace-1")).toEqual([
      expect.objectContaining({ sourceMessageId: "message-1", status: "triaged" })
    ]);
  });

  it("updates action status and result by message id", () => {
    const repository = createAssistantMemoryRepository();

    repository.save(createDraft("Create lead Anna Beispiel", "thread-1", "message-1"));
    const updated = repository.updateActionExecutionResult("workspace-1", "message-1", {
      status: "executed",
      result: { leadId: "L-2026-001", recordId: "lead-record-1" }
    });

    expect(updated).toEqual(
      expect.objectContaining({
        messageId: "message-1",
        status: "executed",
        result: { leadId: "L-2026-001", recordId: "lead-record-1" }
      })
    );
    expect(repository.listActions("workspace-1")).toEqual([
      expect.objectContaining({ messageId: "message-1", status: "executed" })
    ]);
    expect(repository.listAuditEvents("workspace-1").map((event) => event.action)).toEqual([
      "assistant.message.submitted",
      "assistant.action.preview_created",
      "assistant.action.executed"
    ]);
  });

  it("stores explicit audit events", () => {
    const repository = createAssistantMemoryRepository();

    repository.saveAuditEvent(
      createPlatformReleasePlanningAuditEvent({
        workspaceId: "workspace-1",
        actorUserId: "user-1",
        appVersion: "0.1.0",
        plannedCount: 2,
        skippedCount: 1
      })
    );

    expect(repository.listAuditEvents("workspace-1")).toEqual([
      expect.objectContaining({
        action: "platform.release.planned",
        targetType: "PlatformRelease",
        targetId: "0.1.0"
      })
    ]);
  });
});
