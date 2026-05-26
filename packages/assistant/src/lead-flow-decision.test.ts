import { describe, expect, it } from "vitest";
import { decideLeadFlow } from "./lead-flow-decision";
import type { AssistantChannelMessage } from "./channel-message";

const baseMessage = {
  threadId: "thread-1",
  messageId: "message-1",
  receivedAt: "2026-05-26T10:00:00.000Z",
  context: {
    workspaceId: "workspace-demo",
    userId: "user-demo",
    role: "admin",
    route: "/leads",
    module: "leads"
  },
  attachments: []
} satisfies Omit<AssistantChannelMessage, "channel" | "content">;

describe("lead flow decision", () => {
  it("starts a lead draft for new-lead commands", () => {
    expect(
      decideLeadFlow({
        ...baseMessage,
        channel: "telegram",
        content: "/newlead"
      })
    ).toEqual({ kind: "start_draft", source: "new_lead_command" });
  });

  it("updates a selected web lead when source material is attached", () => {
    expect(
      decideLeadFlow({
        ...baseMessage,
        channel: "web",
        content: "Please attach this PDF to the current lead",
        context: {
          ...baseMessage.context,
          selectedRecordIds: ["L-2026-004"]
        },
        attachments: [{ id: "pdf-1", kind: "pdf", fileName: "brief.pdf", mimeType: "application/pdf" }]
      })
    ).toEqual({ kind: "update_existing_lead", leadId: "L-2026-004", source: "selected_record" });
  });

  it("updates a replied Telegram lead when the reply carries new data", () => {
    expect(
      decideLeadFlow({
        ...baseMessage,
        channel: "telegram",
        content: "Add address Gartenweg 9, Bad Aibling",
        replyTo: {
          sourceChannel: "telegram",
          sourceMessageId: "900",
          leadId: "L-2026-004"
        }
      })
    ).toEqual({ kind: "update_existing_lead", leadId: "L-2026-004", source: "reply" });
  });

  it("does not treat replied lead status questions as lead updates", () => {
    expect(
      decideLeadFlow({
        ...baseMessage,
        channel: "telegram",
        content: "What is the status?",
        replyTo: {
          sourceChannel: "telegram",
          sourceMessageId: "900",
          leadId: "L-2026-004"
        }
      })
    ).toEqual({ kind: "not_lead_flow" });
  });

  it("does not treat theme capability requests as lead flow", () => {
    expect(
      decideLeadFlow({
        ...baseMessage,
        channel: "telegram",
        content: "а есть цветовая схема или тема темная для вечера ?"
      })
    ).toEqual({ kind: "not_lead_flow" });
  });

  it("does not treat selected-lead status questions as lead updates", () => {
    expect(
      decideLeadFlow({
        ...baseMessage,
        channel: "web",
        content: "What is waiting next for this lead?",
        context: {
          ...baseMessage.context,
          selectedRecordIds: ["L-2026-004"]
        }
      })
    ).toEqual({ kind: "not_lead_flow" });
  });

  it("starts a draft when first-message source material has no target lead", () => {
    expect(
      decideLeadFlow({
        ...baseMessage,
        channel: "web",
        content: "Create a lead from this client request with address and BGF"
      })
    ).toEqual({ kind: "start_draft", source: "source_material" });
  });
});
