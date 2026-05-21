import { describe, expect, it } from "vitest";
import type { AssistantActionWriteDraft } from "./persistence";
import type { FeedbackItemDraft } from "./feedback-item";
import {
  createPlatformFeedbackBulkUpdatePlan,
  createPlatformFeedbackCsv,
  createPlatformInboxSummary,
  filterPlatformFeedback
} from "./platform-inbox";

const feedback: FeedbackItemDraft[] = [
  {
    workspaceId: "workspace-1",
    sourceThreadId: "thread-1",
    sourceMessageId: "message-1",
    type: "feature_request",
    status: "new",
    priority: "normal",
    moduleContext: "leads",
    role: "admin"
  },
  {
    workspaceId: "workspace-1",
    sourceThreadId: "thread-2",
    sourceMessageId: "message-2",
    type: "bug_report",
    status: "new",
    priority: "normal",
    moduleContext: "clients",
    role: "manager"
  }
];

const actions: AssistantActionWriteDraft[] = [
  {
    workspaceId: "workspace-1",
    threadId: "thread-3",
    messageId: "message-3",
    actionType: "create_lead",
    preview: {
      actionType: "create_lead",
      summary: "Create lead from assistant request",
      changes: [],
      warnings: [],
      requiresConfirmation: true
    },
    status: "awaiting_confirmation",
    requestedByUserId: "user-1"
  }
];

describe("platform inbox summary", () => {
  it("counts feedback and action drafts", () => {
    expect(createPlatformInboxSummary({ feedback, actions })).toMatchObject({
      feedbackCount: 2,
      actionCount: 1,
      openCount: 3
    });
  });

  it("groups feedback by type", () => {
    expect(createPlatformInboxSummary({ feedback, actions }).feedbackByType).toEqual({
      bug_report: 1,
      feature_request: 1
    });
  });

  it("creates rows for feedback and action queues", () => {
    expect(createPlatformInboxSummary({ feedback, actions }).rows).toEqual([
      expect.objectContaining({
        id: "feedback-message-1",
        kind: "feedback",
        label: "feature_request",
        moduleContext: "leads",
        status: "new"
      }),
      expect.objectContaining({
        id: "feedback-message-2",
        kind: "feedback",
        label: "bug_report",
        moduleContext: "clients",
        status: "new"
      }),
      expect.objectContaining({
        id: "action-message-3",
        kind: "action",
        label: "create_lead",
        moduleContext: "assistant",
        status: "awaiting_confirmation"
      })
    ]);
  });

  it("filters feedback by status and type before creating the queue", () => {
    expect(
      filterPlatformFeedback(feedback, {
        status: "new",
        type: "bug_report"
      })
    ).toEqual([expect.objectContaining({ sourceMessageId: "message-2", type: "bug_report" })]);
  });

  it("exports feedback rows as CSV", () => {
    expect(createPlatformFeedbackCsv([feedback[0]!])).toBe(
      [
        "sourceMessageId,type,status,moduleContext,role",
        "message-1,feature_request,new,leads,admin"
      ].join("\n")
    );
  });

  it("creates a bulk update plan for selected feedback rows", () => {
    expect(createPlatformFeedbackBulkUpdatePlan(feedback, "archive")).toEqual({
      event: "archive",
      count: 2,
      items: [
        { workspaceId: "workspace-1", sourceMessageId: "message-1" },
        { workspaceId: "workspace-1", sourceMessageId: "message-2" }
      ]
    });
  });
});
