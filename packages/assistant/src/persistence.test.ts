import { describe, expect, it } from "vitest";
import type { AssistantContext } from "./context";
import { createAssistantPersistenceDraft } from "./persistence";
import { createAssistantSubmissionResult } from "./submission";

const context: AssistantContext = {
  workspaceId: "workspace-1",
  userId: "user-1",
  role: "admin",
  route: "/leads",
  module: "leads",
  selectedRecordIds: ["lead-1"]
};

describe("assistant persistence draft", () => {
  it("maps a submission result into thread and message writes", () => {
    const result = createAssistantSubmissionResult({
      context,
      content: "Please add better mobile filters",
      threadId: "thread-1",
      messageId: "message-1"
    });

    expect(createAssistantPersistenceDraft(result, { threadId: "thread-1", messageId: "message-1" })).toMatchObject({
      thread: {
        id: "thread-1",
        workspaceId: "workspace-1",
        createdByUserId: "user-1",
        title: "Please add better mobile filters"
      },
      message: {
        id: "message-1",
        threadId: "thread-1",
        userId: "user-1",
        role: "user",
        content: "Please add better mobile filters",
        intent: "feature_request",
        context
      }
    });
  });

  it("includes feedback writes when the result has product feedback", () => {
    const result = createAssistantSubmissionResult({
      context,
      content: "Please add better mobile filters",
      threadId: "thread-2",
      messageId: "message-2"
    });

    expect(createAssistantPersistenceDraft(result, { threadId: "thread-2", messageId: "message-2" }).feedback).toEqual({
      workspaceId: "workspace-1",
      sourceThreadId: "thread-2",
      sourceMessageId: "message-2",
      type: "feature_request",
      status: "new",
      priority: "normal",
      moduleContext: "leads",
      role: "admin",
      appVersion: "0.2.0"
    });
  });

  it("includes assistant action writes for action previews", () => {
    const result = createAssistantSubmissionResult({
      context,
      content: "Create lead Anna Beispiel",
      threadId: "thread-3",
      messageId: "message-3"
    });

    expect(createAssistantPersistenceDraft(result, { threadId: "thread-3", messageId: "message-3" }).action).toMatchObject({
      workspaceId: "workspace-1",
      threadId: "thread-3",
      messageId: "message-3",
      actionType: "create_lead",
      status: "awaiting_confirmation",
      requestedByUserId: "user-1"
    });
  });

  it("can attach normalized channel events to the persistence draft", () => {
    const result = createAssistantSubmissionResult({
      context,
      content: "Create lead Anna Beispiel",
      threadId: "thread-4",
      messageId: "message-4"
    });

    expect(
      createAssistantPersistenceDraft(
        result,
        { threadId: "thread-4", messageId: "message-4" },
        {
          channelEvents: [
            {
              type: "message_received",
              channel: "web",
              threadId: "thread-4",
              messageId: "message-4",
              summary: "Create lead Anna Beispiel"
            }
          ]
        }
      ).channelEvents
    ).toEqual([
      {
        type: "message_received",
        channel: "web",
        threadId: "thread-4",
        messageId: "message-4",
        summary: "Create lead Anna Beispiel"
      }
    ]);
  });
});
