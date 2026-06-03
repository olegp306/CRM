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
    expect(CRM_ORCHESTRATOR_DEFAULT_PROMPT).toContain("BALANCED ROUTING MODE");
    expect(CRM_ORCHESTRATOR_DEFAULT_PROMPT).toContain("Lead Creation Agent");
    expect(CRM_ORCHESTRATOR_DEFAULT_PROMPT).toContain("Lead Update Agent");
    expect(CRM_ORCHESTRATOR_DEFAULT_PROMPT).toContain("Lead Search Agent");
    expect(CRM_ORCHESTRATOR_DEFAULT_PROMPT).toContain("lead display name / project title");
    expect(CRM_ORCHESTRATOR_DEFAULT_PROMPT).toContain("search by tag residential");
    expect(CRM_ORCHESTRATOR_DEFAULT_PROMPT).toContain("prefer SEARCH_LEAD over SUPPORT_REQUEST");
    expect(CRM_ORCHESTRATOR_DEFAULT_PROMPT).toContain("INTERNAL ACTORS AND TESTERS");
    expect(CRM_ORCHESTRATOR_DEFAULT_PROMPT).toContain("Oleg Panyukov");
    expect(CRM_ORCHESTRATOR_DEFAULT_PROMPT).toContain("Ekaterina Reyzbikh");
    expect(CRM_ORCHESTRATOR_DEFAULT_PROMPT).toContain('"CREATE_REMINDER"');
    expect(CRM_ORCHESTRATOR_DEFAULT_PROMPT).toContain('"SUPPORT_REQUEST"');
    expect(CRM_ORCHESTRATOR_DEFAULT_PROMPT).not.toContain('"create_reminder"');
    expect(CRM_ORCHESTRATOR_DEFAULT_PROMPT).toContain("через <number> дней/дня/день");
    expect(CRM_ORCHESTRATOR_DEFAULT_PROMPT).toContain("The number may be written as digits or Russian words");
    expect(CRM_ORCHESTRATOR_DEFAULT_PROMPT).toContain("Do not reject a reminder only because the day count is written in words.");
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

  it("routes conversational Russian follow-up wording to the reminder agent instead of lead creation", () => {
    const result = routeCrmOrchestratorRequest({
      ...baseMessage,
      content: "Müller Bau, застройщик из Баварии, через неделю зафоллоуапить"
    });

    expect(result).toMatchObject({
      intent: "CREATE_REMINDER",
      action: "Reminder Agent",
      status: "ready"
    });
  });

  it("routes conditional public-authority callbacks as reminders", () => {
    const result = routeCrmOrchestratorRequest({
      ...baseMessage,
      content: "Если Bauamt не ответит до пятницы, позвонить им"
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

  it("routes table export requests through the lead search agent for later search/filter execution", () => {
    const result = routeCrmOrchestratorRequest({
      ...baseMessage,
      content: "Send me CSV export of leads from last month"
    });

    expect(result).toMatchObject({
      intent: "SEARCH_LEAD",
      action: "Lead Search Agent",
      status: "ready"
    });
    expect(result.reasoning).toContain("search");
  });

  it("routes broad filtered lead list requests to the lead search agent without asking for a person", () => {
    const result = routeCrmOrchestratorRequest({
      ...baseMessage,
      content: "Покажи всех warm лидов за прошлый месяц"
    });

    expect(result).toMatchObject({
      intent: "SEARCH_LEAD",
      action: "Lead Search Agent",
      status: "ready"
    });
  });

  it("routes human project-title search phrasing to the lead search agent", () => {
    const result = routeCrmOrchestratorRequest({
      ...baseMessage,
      content: "Find project Schneider EFH near the lake"
    });

    expect(result).toMatchObject({
      intent: "SEARCH_LEAD",
      action: "Lead Search Agent",
      status: "ready"
    });
  });

  it("routes existing CRM context questions to search instead of support", () => {
    const result = routeCrmOrchestratorRequest({
      ...baseMessage,
      content: "What do we have about the house in Munich?"
    });

    expect(result).toMatchObject({
      intent: "SEARCH_LEAD",
      action: "Lead Search Agent",
      status: "ready"
    });
  });

  it("treats file-only attachment requests as lead update clarifications, not a separate file agent", () => {
    const result = routeCrmOrchestratorRequest({
      ...baseMessage,
      content: "Attach this PDF to the CRM record",
      attachments: [{ id: "pdf-1", kind: "pdf", fileName: "brief.pdf", mimeType: "application/pdf" }]
    });

    expect(result).toMatchObject({
      intent: "UPDATE_LEAD",
      action: "clarification",
      status: "need_clarification",
      message: "Which lead should I update with this material?"
    });
  });

  it("routes product capability questions to support instead of capability or feature handling", () => {
    const result = routeCrmOrchestratorRequest({
      ...baseMessage,
      content: "Do we have a dark theme for evening work?"
    });

    expect(result).toMatchObject({
      intent: "SUPPORT_REQUEST",
      action: "Support Agent",
      status: "ready"
    });
  });

  it("routes broad product feedback wording to support instead of feature request handling", () => {
    const result = routeCrmOrchestratorRequest({
      ...baseMessage,
      content: "Please add a nicer onboarding screen later"
    });

    expect(result).toMatchObject({
      intent: "SUPPORT_REQUEST",
      action: "Support Agent",
      status: "ready"
    });
  });
});
