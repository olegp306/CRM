import { describe, expect, it } from "vitest";
import type { AssistantAuditEventDraft } from "./audit-log";
import { createAuditReviewSummary, createAuditEventsCsv, filterAuditEvents } from "./audit-review";

const events: AssistantAuditEventDraft[] = [
  {
    workspaceId: "workspace-1",
    actorUserId: "user-1",
    action: "assistant.message.submitted",
    targetType: "AssistantMessage",
    targetId: "message-1",
    metadata: { intent: "feature_request", moduleContext: "assistant", threadId: "thread-1" }
  },
  {
    workspaceId: "workspace-1",
    actorUserId: "user-1",
    action: "assistant.action.preview_created",
    targetType: "AssistantAction",
    targetId: "message-2",
    metadata: { actionType: "generate_kp", status: "awaiting_confirmation", threadId: "thread-2" }
  },
  {
    workspaceId: "workspace-1",
    actorUserId: "user-2",
    action: "assistant.action.executed",
    targetType: "AssistantAction",
    targetId: "message-2",
    metadata: {
      actionType: "generate_kp",
      status: "executed",
      threadId: "thread-2",
      result: { documentId: "D-20260521-message-2" }
    }
  },
  {
    workspaceId: "workspace-1",
    actorUserId: "user-1",
    action: "platform.release.planned",
    targetType: "PlatformRelease",
    targetId: "0.1.0",
    metadata: { appVersion: "0.1.0", plannedCount: 2, skippedCount: 1 }
  }
];

describe("audit review helpers", () => {
  it("filters audit events by action, actor, and free-text query", () => {
    expect(
      filterAuditEvents(events, {
        action: "assistant.action.executed",
        actorUserId: "user-2",
        query: "document"
      })
    ).toEqual([events[2]]);
  });

  it("creates summary counts for audit review", () => {
    expect(createAuditReviewSummary(events)).toEqual({
      totalCount: 4,
      actionCounts: {
        "assistant.action.executed": 1,
        "assistant.action.preview_created": 1,
        "assistant.channel.event": 0,
        "assistant.message.submitted": 1,
        "platform.release.planned": 1
      },
      actorCounts: {
        "user-1": 3,
        "user-2": 1
      },
      executedActionCount: 1
    });
  });

  it("exports audit events to CSV", () => {
    expect(createAuditEventsCsv([events[2]])).toBe(
      [
        "action,targetType,targetId,actorUserId,metadata",
        '"assistant.action.executed","AssistantAction","message-2","user-2","{""actionType"":""generate_kp"",""status"":""executed"",""threadId"":""thread-2"",""result"":{""documentId"":""D-20260521-message-2""}}"'
      ].join("\n")
    );
  });
});
