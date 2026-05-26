import { describe, expect, it } from "vitest";
import type { AssistantContext } from "./context";
import { createAssistantSubmissionResult } from "./submission";

const baseContext: AssistantContext = {
  workspaceId: "workspace-1",
  userId: "user-1",
  role: "admin",
  route: "/leads",
  module: "leads",
  selectedRecordIds: []
};

describe("assistant submission orchestration", () => {
  it("creates a thread and message draft from trimmed user text", () => {
    const result = createAssistantSubmissionResult({
      context: baseContext,
      content: "  Help me create a lead for Anna Beispiel  ",
      threadId: "thread-1",
      messageId: "message-1"
    });

    expect(result.thread).toEqual({
      workspaceId: "workspace-1",
      createdByUserId: "user-1",
      title: "Help me create a lead for Anna Beispiel"
    });
    expect(result.message.content).toBe("Help me create a lead for Anna Beispiel");
    expect(result.message.intent).toBe("crm_action");
  });

  it("creates feedback drafts for product signal intents", () => {
    const result = createAssistantSubmissionResult({
      context: { ...baseContext, module: "assistant" },
      content: "Please add a better mobile table layout",
      threadId: "thread-2",
      messageId: "message-2"
    });

    expect(result.feedback).toEqual({
      workspaceId: "workspace-1",
      sourceThreadId: "thread-2",
      sourceMessageId: "message-2",
      type: "feature_request",
      status: "new",
      priority: "normal",
      moduleContext: "assistant",
      role: "admin",
      appVersion: "0.1.6"
    });
    expect(result.response).toBe("I saved this as product feedback for review.");
  });

  it("previews create lead actions for owner and admin roles", () => {
    const result = createAssistantSubmissionResult({
      context: baseContext,
      content: "Create lead Anna Beispiel",
      threadId: "thread-3",
      messageId: "message-3"
    });

    expect(result.actionPreview).toMatchObject({
      actionType: "create_lead",
      summary: "Create lead from assistant request",
      requiresConfirmation: true
    });
    expect(result.confirmationStatus).toBe("awaiting_confirmation");
    expect(result.response).toBe("I prepared a create lead preview. Confirm before I execute it.");
  });

  it("routes source-material uploads to lead intake before create lead previews", () => {
    const result = createAssistantSubmissionResult({
      context: { ...baseContext, route: "/leads", module: "leads" },
      content: "Create lead Anna Beispiel from this source material",
      threadId: "thread-source-upload",
      messageId: "message-source-upload",
      attachments: [
        {
          id: "attachment-1",
          kind: "pdf",
          fileName: "brief.pdf",
          mimeType: "application/pdf",
          base64: "JVBERi0x"
        }
      ]
    });

    expect(result.response).toContain("I can create a lead from this source material");
    expect(result.actionPreview).toBeNull();
    expect(result.confirmationStatus).toBeNull();
    expect(result.feedback).toBeNull();
  });

  it("routes clear source-material intake text to lead intake before create lead previews", () => {
    const result = createAssistantSubmissionResult({
      context: { ...baseContext, route: "/leads", module: "leads" },
      content: "Create a lead from this client request with address and BGF",
      threadId: "thread-source-text",
      messageId: "message-source-text"
    });

    expect(result.response).toContain("I can create a lead from this source material");
    expect(result.actionPreview).toBeNull();
    expect(result.confirmationStatus).toBeNull();
    expect(result.feedback).toBeNull();
  });

  it("previews schedule follow-up actions when the request asks for a reminder", () => {
    const result = createAssistantSubmissionResult({
      context: baseContext,
      content: "Schedule follow-up for lead L-2026-001 tomorrow",
      threadId: "thread-5",
      messageId: "message-5"
    });

    expect(result.actionPreview).toMatchObject({
      actionType: "schedule_followup",
      summary: "Schedule follow-up from assistant request",
      changes: [{ field: "followup.sourceText", from: null, to: "Schedule follow-up for lead L-2026-001 tomorrow" }],
      requiresConfirmation: true
    });
    expect(result.confirmationStatus).toBe("awaiting_confirmation");
    expect(result.response).toBe("I prepared a schedule follow-up preview. Confirm before I execute it.");
  });

  it("previews project task update actions when the request targets project tasks", () => {
    const result = createAssistantSubmissionResult({
      context: { ...baseContext, route: "/projects", module: "projects", selectedRecordIds: ["P-2026-001"] },
      content: "Update project task permit package to done",
      threadId: "thread-6",
      messageId: "message-6"
    });

    expect(result.actionPreview).toMatchObject({
      actionType: "update_project_task",
      summary: "Update project task from assistant request",
      changes: [
        { field: "project.selectedRecordIds", from: null, to: ["P-2026-001"] },
        { field: "task.sourceText", from: null, to: "Update project task permit package to done" }
      ],
      requiresConfirmation: true
    });
    expect(result.confirmationStatus).toBe("awaiting_confirmation");
    expect(result.response).toBe("I prepared an update project task preview. Confirm before I execute it.");
  });

  it("previews KP generation actions when the request asks for an offer document", () => {
    const result = createAssistantSubmissionResult({
      context: { ...baseContext, route: "/documents", module: "documents", selectedRecordIds: ["L-2026-001"] },
      content: "Generate KP for lead L-2026-001",
      threadId: "thread-7",
      messageId: "message-7"
    });

    expect(result.actionPreview).toMatchObject({
      actionType: "generate_kp",
      summary: "Generate KP document from assistant request",
      changes: [
        { field: "document.type", from: null, to: "kp" },
        { field: "document.selectedRecordIds", from: null, to: ["L-2026-001"] },
        { field: "document.sourceText", from: null, to: "Generate KP for lead L-2026-001" }
      ],
      requiresConfirmation: true
    });
    expect(result.confirmationStatus).toBe("awaiting_confirmation");
    expect(result.response).toBe("I prepared a generate KP preview. Confirm before I execute it.");
  });

  it("previews KP sent actions for selected leads", () => {
    const result = createAssistantSubmissionResult({
      context: { ...baseContext, selectedRecordIds: ["L-2026-001"] },
      content: "Mark KP sent for this lead",
      threadId: "thread-8",
      messageId: "message-8"
    });

    expect(result.actionPreview).toMatchObject({
      actionType: "mark_kp_sent",
      summary: "Mark KP as sent from assistant request",
      changes: [
        { field: "lead.selectedRecordIds", from: null, to: ["L-2026-001"] },
        { field: "lead.sourceText", from: null, to: "Mark KP sent for this lead" }
      ],
      requiresConfirmation: true
    });
    expect(result.confirmationStatus).toBe("awaiting_confirmation");
    expect(result.response).toBe("I prepared a mark KP sent preview. Confirm before I execute it.");
  });

  it("blocks action mode for roles without permission and creates permission feedback", () => {
    const result = createAssistantSubmissionResult({
      context: { ...baseContext, role: "viewer" },
      content: "Create lead Anna Beispiel",
      threadId: "thread-4",
      messageId: "message-4"
    });

    expect(result.actionPreview).toBeNull();
    expect(result.permissionBlocked?.feedbackType).toBe("permission_blocked");
    expect(result.feedback?.type).toBe("permission_blocked");
    expect(result.confirmationStatus).toBe("cancelled");
  });

  it("answers assistant identity questions without creating feedback", () => {
    const result = createAssistantSubmissionResult({
      context: { ...baseContext, route: "/leads", module: "leads" },
      content: "Кто ты и что умеешь?",
      threadId: "thread-help",
      messageId: "message-help"
    });

    expect(result.response).toContain("I can create and update leads");
    expect(result.feedback).toBeNull();
    expect(result.actionPreview).toBeNull();
  });

  it("keeps source-material uploads in assistant context without creating feature feedback", () => {
    const result = createAssistantSubmissionResult({
      context: { ...baseContext, route: "/leads", module: "leads" },
      content: "Проверь этот план и создай лид, если данных хватает",
      threadId: "thread-upload",
      messageId: "message-upload",
      attachments: [
        {
          id: "attachment-1",
          kind: "photo",
          fileName: "site.jpg",
          mimeType: "image/jpeg",
          base64: "abcd"
        }
      ]
    });

    expect(result.feedback).toBeNull();
  });
});
