import { describe, expect, it } from "vitest";
import { runCrmLangGraphOrchestrator } from "./crm-langgraph-orchestrator";

describe("crm langgraph orchestrator", () => {
  it("routes Telegram source material to lead creation", async () => {
    const result = await runCrmLangGraphOrchestrator({
      workspaceId: "workspace-demo",
      channel: "telegram",
      chatId: "410",
      messageId: "10",
      text: "new lead: Irina Schneider wants an EFH proposal, BGF 195 m2, Bad Aibling, irina@example.com",
      receivedAt: "2026-06-05T10:00:00.000Z"
    });

    expect(result.runtime).toBe("langgraph");
    expect(result.action).toEqual({
      type: "create_lead",
      reason: expect.stringContaining("new lead")
    });
  });

  it("routes a replied field instruction to lead update", async () => {
    const result = await runCrmLangGraphOrchestrator({
      workspaceId: "workspace-demo",
      channel: "telegram",
      chatId: "410",
      messageId: "11",
      replyToLeadId: "L-2026-777",
      text: "Take only the client phone from the screenshot",
      receivedAt: "2026-06-05T10:00:00.000Z"
    });

    expect(result.action).toMatchObject({
      type: "update_lead",
      leadId: "L-2026-777",
      fieldCommand: {
        field: "phone",
        sourceScope: "attachments",
        only: true
      }
    });
  });

  it("routes a replied follow-up request to reminder creation", async () => {
    const result = await runCrmLangGraphOrchestrator({
      workspaceId: "workspace-demo",
      channel: "telegram",
      chatId: "410",
      messageId: "12",
      replyToLeadId: "L-2026-777",
      text: "remind me tomorrow to call the client about missing BGF",
      receivedAt: "2026-06-05T10:00:00.000Z"
    });

    expect(result.action).toMatchObject({
      type: "create_reminder",
      leadId: "L-2026-777",
      summary: expect.stringContaining("call the client"),
      dueAt: "2026-06-06T09:00:00.000Z"
    });
  });

  it("routes a replied personal context note to lead context", async () => {
    const result = await runCrmLangGraphOrchestrator({
      workspaceId: "workspace-demo",
      channel: "telegram",
      chatId: "410",
      messageId: "13",
      replyToLeadId: "L-2026-777",
      text: "Запомни об этом клиенте: любит футбол и каждый год ходит на Oktoberfest.",
      receivedAt: "2026-06-05T10:00:00.000Z"
    });

    expect(result.action).toMatchObject({
      type: "add_context_note",
      leadId: "L-2026-777",
      note: expect.stringContaining("Oktoberfest")
    });
  });
});
