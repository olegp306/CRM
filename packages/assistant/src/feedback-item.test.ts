import { describe, expect, it } from "vitest";
import { createFeedbackItemFromMessage, shouldCreateFeedbackItem } from "./feedback-item";

describe("feedback item creation", () => {
  it("creates feedback for product signal intents", () => {
    expect(shouldCreateFeedbackItem("feature_request")).toBe(true);
    expect(shouldCreateFeedbackItem("bug_report")).toBe(true);
    expect(shouldCreateFeedbackItem("support_request")).toBe(true);
    expect(shouldCreateFeedbackItem("ux_feedback")).toBe(true);
    expect(shouldCreateFeedbackItem("permission_blocked")).toBe(true);
  });

  it("does not create feedback for ordinary CRM actions", () => {
    expect(shouldCreateFeedbackItem("crm_action")).toBe(false);
    expect(shouldCreateFeedbackItem("other")).toBe(false);
  });

  it("maps assistant messages into feedback item drafts", () => {
    expect(
      createFeedbackItemFromMessage({
        workspaceId: "workspace-1",
        sourceThreadId: "thread-1",
        sourceMessageId: "message-1",
        intent: "bug_report",
        moduleContext: "documents",
        role: "manager"
      })
    ).toEqual({
      workspaceId: "workspace-1",
      sourceThreadId: "thread-1",
      sourceMessageId: "message-1",
      type: "bug_report",
      status: "new",
      priority: "normal",
      moduleContext: "documents",
      role: "manager",
      appVersion: "0.1.6"
    });
  });
});
