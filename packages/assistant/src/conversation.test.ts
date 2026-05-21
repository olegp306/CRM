import { describe, expect, it } from "vitest";
import type { AssistantContext } from "./context";
import { appendAssistantExchange, getAssistantModuleFromRoute } from "./conversation";
import type { AssistantSubmissionResult } from "./submission";

const context: AssistantContext = {
  workspaceId: "workspace-1",
  userId: "user-1",
  role: "admin",
  route: "/leads",
  module: "leads",
  selectedRecordIds: []
};

const result: AssistantSubmissionResult = {
  thread: {
    workspaceId: "workspace-1",
    createdByUserId: "user-1",
    title: "Create lead Anna"
  },
  message: {
    threadId: "thread-1",
    userId: "user-1",
    role: "user",
    content: "Create lead Anna",
    context,
    intent: "crm_action"
  },
  response: "I prepared a create lead preview. Confirm before I execute it.",
  feedback: null,
  actionPreview: null,
  confirmationStatus: "awaiting_confirmation",
  permissionBlocked: null
};

describe("assistant conversation helpers", () => {
  it("maps routes to assistant module context", () => {
    expect(getAssistantModuleFromRoute("/clients/acme")).toBe("clients");
    expect(getAssistantModuleFromRoute("/leads/intake-preview")).toBe("leads");
    expect(getAssistantModuleFromRoute("/projects")).toBe("projects");
    expect(getAssistantModuleFromRoute("/outreach")).toBe("outreach");
    expect(getAssistantModuleFromRoute("/content")).toBe("content");
    expect(getAssistantModuleFromRoute("/settings/branding")).toBe("settings");
    expect(getAssistantModuleFromRoute("/assistant/preview")).toBe("assistant");
    expect(getAssistantModuleFromRoute("/unknown")).toBe("other");
  });

  it("appends a user and assistant exchange without mutating history", () => {
    const existing = [{ id: "existing", role: "assistant" as const, content: "Earlier", intent: "other" as const }];

    const next = appendAssistantExchange(existing, result, "message-1");

    expect(existing).toHaveLength(1);
    expect(next).toEqual([
      existing[0],
      {
        id: "message-1",
        role: "user",
        content: "Create lead Anna",
        intent: "crm_action"
      },
      {
        id: "message-1-response",
        role: "assistant",
        content: "I prepared a create lead preview. Confirm before I execute it.",
        intent: "crm_action"
      }
    ]);
  });
});
