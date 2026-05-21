import { describe, expect, it } from "vitest";
import type { AssistantContext } from "./context";
import { createAssistantMessageDraft, createAssistantThreadDraft } from "./thread-message";

const context: AssistantContext = {
  workspaceId: "workspace-1",
  userId: "user-1",
  role: "admin",
  route: "/leads",
  module: "leads",
  selectedRecordIds: []
};

describe("assistant thread and message drafts", () => {
  it("creates a thread draft with title and creator", () => {
    expect(createAssistantThreadDraft({ context, title: "Lead intake" })).toEqual({
      workspaceId: "workspace-1",
      createdByUserId: "user-1",
      title: "Lead intake"
    });
  });

  it("creates a user message draft with classified intent and context", () => {
    expect(
      createAssistantMessageDraft({
        threadId: "thread-1",
        userId: "user-1",
        role: "user",
        content: "Please add mobile filters",
        context
      })
    ).toEqual({
      threadId: "thread-1",
      userId: "user-1",
      role: "user",
      content: "Please add mobile filters",
      context,
      intent: "feature_request"
    });
  });
});
