import { describe, expect, it } from "vitest";
import { createLeadChatOrchestratorResponse } from "./lead-chat-orchestrator";
import type { AssistantChannelMessage } from "./channel-message";

const baseMessage = {
  channel: "web",
  threadId: "thread-1",
  messageId: "message-1",
  receivedAt: "2026-05-26T08:00:00.000Z",
  context: {
    workspaceId: "workspace-demo",
    userId: "user-demo",
    role: "admin",
    route: "/leads",
    module: "leads"
  },
  attachments: []
} satisfies Omit<AssistantChannelMessage, "content">;

describe("lead chat orchestrator", () => {
  it("starts the same new-lead intake scenario for web and Telegram commands", () => {
    const result = createLeadChatOrchestratorResponse({
      message: {
        ...baseMessage,
        channel: "telegram",
        content: "/newlead"
      }
    });

    expect(result?.intent).toBe("lead_intake");
    expect(result?.normalizedActions).toEqual([]);
    expect(result?.buttons).toEqual([{ label: "Attach source", action: "open_upload" }]);
    expect(result?.text).toContain("Send the client request");
  });

  it("routes first-message source material into lead creation", () => {
    const result = createLeadChatOrchestratorResponse({
      message: {
        ...baseMessage,
        content: "Create a lead from this client request with address, BGF and contacts"
      }
    });

    expect(result?.intent).toBe("lead_intake");
    expect(result?.buttons).toEqual([{ label: "Create lead", action: "confirm" }]);
    expect(result?.normalizedActions).toEqual([]);
    expect(result?.text).toContain("I can create a lead from this source material");
  });

  it("routes source material against a replied lead into an update scenario", () => {
    const result = createLeadChatOrchestratorResponse({
      message: {
        ...baseMessage,
        channel: "telegram",
        content: "Add this address: Gartenweg 9, Bad Aibling",
        replyTo: {
          sourceChannel: "telegram",
          sourceMessageId: "900",
          leadId: "L-2026-004"
        }
      }
    });

    expect(result?.intent).toBe("lead_update");
    expect(result?.normalizedActions).toEqual(["open_crm"]);
    expect(result?.buttons).toEqual([{ label: "CRM", action: "open_crm", url: "/leads?leadId=L-2026-004" }]);
    expect(result?.text).toContain("L-2026-004");
    expect(result?.text).toContain("update this lead");
  });

  it("uses the selected web lead as the update target when no reply exists", () => {
    const result = createLeadChatOrchestratorResponse({
      message: {
        ...baseMessage,
        content: "Attach this PDF to the current lead",
        context: {
          ...baseMessage.context,
          selectedRecordIds: ["L-2026-009"]
        },
        attachments: [{ id: "pdf-1", kind: "pdf", fileName: "brief.pdf", mimeType: "application/pdf" }]
      }
    });

    expect(result?.intent).toBe("lead_update");
    expect(result?.normalizedActions).toEqual(["open_crm"]);
    expect(result?.buttons[0]).toEqual({ label: "CRM", action: "open_crm", url: "/leads?leadId=L-2026-009" });
  });

  it("summarizes missing KP fields for an existing lead", () => {
    const result = createLeadChatOrchestratorResponse({
      message: {
        ...baseMessage,
        content: "What is waiting next?"
      },
      lead: {
        leadId: "L-2026-010",
        missingFields: ["projectAddress", "bgfM2"],
        kpReady: false
      }
    });

    expect(result?.intent).toBe("support_request");
    expect(result?.normalizedActions).toEqual(["open_crm"]);
    expect(result?.buttons).toEqual([{ label: "CRM", action: "open_crm", url: "/leads?leadId=L-2026-010" }]);
    expect(result?.text).toContain("projectAddress, bgfM2");
  });

  it("returns normalized KP-ready actions for an existing lead", () => {
    const result = createLeadChatOrchestratorResponse({
      message: {
        ...baseMessage,
        content: "Is KP ready?"
      },
      lead: {
        leadId: "L-2026-011",
        missingFields: [],
        kpReady: true,
        pdfUrl: "/api/kp/L-2026-011.pdf",
        docxUrl: "/api/kp/L-2026-011.docx",
        canSendKp: true,
        kpSent: true
      }
    });

    expect(result?.intent).toBe("crm_action");
    expect(result?.normalizedActions).toEqual(["open_crm", "open_pdf", "download_doc", "send_kp", "mark_kp_sent", "undo_kp_sent"]);
    expect(result?.buttons).toEqual([
      { label: "CRM", action: "open_crm", url: "/leads?leadId=L-2026-011" },
      { label: "PDF", action: "open_pdf", url: "/api/kp/L-2026-011.pdf" },
      { label: "DOC", action: "download_doc", url: "/api/kp/L-2026-011.docx" },
      { label: "Send KP", action: "send_kp" },
      { label: "Mark KP sent", action: "mark_kp_sent" },
      { label: "Undo KP sent", action: "undo_kp_sent" }
    ]);
  });
});
