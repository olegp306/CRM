import { describe, expect, it, vi } from "vitest";
import { createOpenAiCrmOrchestrator } from "./openai-crm-orchestrator";
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

describe("openai crm orchestrator", () => {
  it("passes workspace prompt and stronger model into the Responses request", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          intent: "SEARCH_LEAD",
          reasoning: "The user is searching by phone.",
          action: "Lead Search Agent",
          status: "ready",
          message: "Passing the request to the lead search agent."
        })
      })
    }));
    const orchestrator = createOpenAiCrmOrchestrator({
      apiKey: "openai-key",
      model: "gpt-5.2",
      prompt: "Custom CRM Orchestrator Agent prompt.",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    const decision = await orchestrator.route({
      ...baseMessage,
      content: "Find the client by phone +49 160 4442211"
    });

    expect(decision.intent).toBe("SEARCH_LEAD");
    const firstCall = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const request = JSON.parse(String(firstCall[1].body));
    expect(firstCall[0]).toBe("https://api.openai.com/v1/responses");
    expect(request.model).toBe("gpt-5.2");
    expect(request.input[0].content).toContain("Custom CRM Orchestrator Agent prompt.");
    expect(request.input[1].content).toContain("Channel: telegram");
    expect(request.input[1].content).toContain("Find the client by phone");
    expect(request.text.format.name).toBe("crm_orchestrator_decision");
  });
});
