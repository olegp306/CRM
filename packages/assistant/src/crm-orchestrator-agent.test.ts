import { describe, expect, it } from "vitest";
import { CRM_ORCHESTRATOR_DEFAULT_PROMPT, routeCrmOrchestratorRequest } from "./crm-orchestrator-agent";
import type { AssistantChannelMessage } from "./channel-message";

const baseMessage = {
  channel: "telegram",
  threadId: "telegram-1",
  messageId: "message-1",
  receivedAt: "2026-05-31T10:00:00.000Z",
  context: {
    workspaceId: "workspace-demo",
    userId: "telegram:1",
    role: "admin",
    route: "/telegram",
    module: "assistant"
  },
  attachments: []
} satisfies Omit<AssistantChannelMessage, "content">;

describe("CRM orchestrator agent", () => {
  it("keeps the default routing prompt available for workspace settings", () => {
    expect(CRM_ORCHESTRATOR_DEFAULT_PROMPT).toContain("CRM Orchestrator Agent");
    expect(CRM_ORCHESTRATOR_DEFAULT_PROMPT).toContain("Lead Creation Agent");
    expect(CRM_ORCHESTRATOR_DEFAULT_PROMPT).toContain("Lead Update Agent");
    expect(CRM_ORCHESTRATOR_DEFAULT_PROMPT).toContain("OUTPUT FORMAT");
  });

  it("routes complete new client material to lead creation", () => {
    const result = routeCrmOrchestratorRequest({
      ...baseMessage,
      content: "Add a new lead: Anna Meyer, anna@example.com, project in Munich, BGF 180 m2"
    });

    expect(result).toMatchObject({
      intent: "CREATE_LEAD",
      action: "Lead Creation Agent",
      status: "ready"
    });
  });

  it("asks one clarification when creating a lead without contact data", () => {
    const result = routeCrmOrchestratorRequest({
      ...baseMessage,
      content: "Add a new lead Anna Meyer for a house project in Munich"
    });

    expect(result).toMatchObject({
      intent: "CREATE_LEAD",
      action: "clarification",
      status: "need_clarification",
      message: "What phone or email should I save for this new lead?"
    });
  });

  it("routes replied notes to lead update", () => {
    const result = routeCrmOrchestratorRequest({
      ...baseMessage,
      content: "Add a note: we met for coffee and he likes jazz",
      replyTo: {
        sourceChannel: "telegram",
        sourceMessageId: "900",
        leadId: "L-2026-004"
      }
    });

    expect(result).toMatchObject({
      intent: "UPDATE_LEAD",
      action: "Lead Update Agent",
      status: "ready"
    });
  });

  it("routes Russian reminder requests to the reminder agent", () => {
    const result = routeCrmOrchestratorRequest({
      ...baseMessage,
      content:
        "\u041d\u0430\u043f\u043e\u043c\u043d\u0438 \u0437\u0430\u0432\u0442\u0440\u0430 \u043f\u043e\u0437\u0432\u043e\u043d\u0438\u0442\u044c \u043b\u0438\u0434\u0443 L-2026-004"
    });

    expect(result).toMatchObject({
      intent: "CREATE_REMINDER",
      action: "Reminder Agent",
      status: "ready"
    });
  });

  it("routes Russian additional client information to lead update", () => {
    const result = routeCrmOrchestratorRequest({
      ...baseMessage,
      content:
        "\u0414\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u0430\u044f \u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u044f \u043f\u043e \u043b\u0438\u0434\u0443 L-2026-004: \u043b\u044e\u0431\u0438\u0442 \u0434\u0436\u0430\u0437 \u0438 \u043a\u043e\u0440\u043e\u0442\u043a\u0438\u0435 \u043f\u0438\u0441\u044c\u043c\u0430."
    });

    expect(result).toMatchObject({
      intent: "UPDATE_LEAD",
      action: "Lead Update Agent",
      status: "ready"
    });
  });

  it("does not create a lead from a search request", () => {
    const result = routeCrmOrchestratorRequest({
      ...baseMessage,
      content: "Find the client by phone +49 160 4442211"
    });

    expect(result).toMatchObject({
      intent: "SEARCH_LEAD",
      action: "Lead Search Agent",
      status: "ready"
    });
  });

  it("asks for target entity before attaching a file without lead context", () => {
    const result = routeCrmOrchestratorRequest({
      ...baseMessage,
      content: "Attach this PDF to the CRM record",
      attachments: [{ id: "pdf-1", kind: "pdf", fileName: "brief.pdf", mimeType: "application/pdf" }]
    });

    expect(result).toMatchObject({
      intent: "ATTACH_FILE",
      action: "clarification",
      status: "need_clarification",
      message: "Which lead should I attach this file to?"
    });
  });
});
