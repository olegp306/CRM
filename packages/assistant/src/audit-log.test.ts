import { describe, expect, it } from "vitest";
import type { AssistantContext } from "./context";
import { createAssistantActionExecutionAuditEvent, createAssistantAuditEvents, createPlatformReleasePlanningAuditEvent } from "./audit-log";
import { createAssistantPersistenceDraft } from "./persistence";
import { createAssistantSubmissionResult } from "./submission";

const context: AssistantContext = {
  workspaceId: "workspace-1",
  userId: "user-1",
  role: "admin",
  route: "/leads",
  module: "leads",
  selectedRecordIds: []
};

describe("assistant audit events", () => {
  it("records message submission audit event", () => {
    const result = createAssistantSubmissionResult({
      context,
      content: "Please add mobile filters",
      threadId: "thread-1",
      messageId: "message-1"
    });
    const draft = createAssistantPersistenceDraft(result, { threadId: "thread-1", messageId: "message-1" });

    expect(createAssistantAuditEvents(draft)).toEqual([
      expect.objectContaining({
        workspaceId: "workspace-1",
        actorUserId: "user-1",
        action: "assistant.message.submitted",
        targetType: "AssistantMessage",
        targetId: "message-1"
      })
    ]);
  });

  it("adds action preview audit event when a preview is created", () => {
    const result = createAssistantSubmissionResult({
      context,
      content: "Create lead Anna Beispiel",
      threadId: "thread-2",
      messageId: "message-2"
    });
    const draft = createAssistantPersistenceDraft(result, { threadId: "thread-2", messageId: "message-2" });

    expect(createAssistantAuditEvents(draft).map((event) => event.action)).toEqual([
      "assistant.message.submitted",
      "assistant.action.preview_created"
    ]);
  });

  it("records executed action audit event with result metadata", () => {
    expect(
      createAssistantActionExecutionAuditEvent({
        workspaceId: "workspace-1",
        actorUserId: "user-1",
        threadId: "thread-2",
        messageId: "message-2",
        actionType: "create_lead",
        status: "executed",
        result: { leadId: "L-2026-001", recordId: "lead-record-1" }
      })
    ).toEqual({
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      action: "assistant.action.executed",
      targetType: "AssistantAction",
      targetId: "message-2",
      metadata: {
        actionType: "create_lead",
        status: "executed",
        threadId: "thread-2",
        result: { leadId: "L-2026-001", recordId: "lead-record-1" }
      }
    });
  });

  it("records normalized channel events as audit entries", () => {
    const result = createAssistantSubmissionResult({
      context,
      content: "Create lead Anna Beispiel",
      threadId: "thread-channel-1",
      messageId: "message-channel-1"
    });
    const draft = createAssistantPersistenceDraft(
      result,
      { threadId: "thread-channel-1", messageId: "message-channel-1" },
      {
        channelEvents: [
          {
            type: "lead_created",
            channel: "web",
            threadId: "thread-channel-1",
            leadId: "L-2026-020",
            fieldsCreated: ["clientName", "projectAddress"],
            missingData: []
          }
        ]
      }
    );

    expect(createAssistantAuditEvents(draft).at(-1)).toEqual({
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      action: "assistant.channel.event",
      targetType: "AssistantChannelEvent",
      targetId: "web:lead_created:thread-channel-1:L-2026-020",
      metadata: {
        type: "lead_created",
        channel: "web",
        threadId: "thread-channel-1",
        leadId: "L-2026-020",
        fieldsCreated: ["clientName", "projectAddress"],
        missingData: []
      }
    });
  });


  it("records release planning audit event with version metadata", () => {
    expect(
      createPlatformReleasePlanningAuditEvent({
        workspaceId: "workspace-1",
        actorUserId: "user-1",
        appVersion: "0.1.0",
        plannedCount: 3,
        skippedCount: 1
      })
    ).toEqual({
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      action: "platform.release.planned",
      targetType: "PlatformRelease",
      targetId: "0.1.0",
      metadata: {
        appVersion: "0.1.0",
        plannedCount: 3,
        skippedCount: 1
      }
    });
  });
});
