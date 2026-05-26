import { describe, expect, it } from "vitest";
import type { AssistantChannelMessage } from "./channel-message";

describe("assistant channel message contracts", () => {
  it("represents a web message with attachments and selected CRM context", () => {
    const message: AssistantChannelMessage = {
      channel: "web",
      threadId: "thread-1",
      messageId: "message-1",
      content: "Create a lead from this PDF",
      receivedAt: "2026-05-26T08:00:00.000Z",
      context: {
        workspaceId: "workspace-demo",
        userId: "user-demo",
        role: "admin",
        route: "/leads",
        module: "leads",
        selectedRecordIds: ["L-2026-004"]
      },
      attachments: [
        {
          id: "attachment-1",
          kind: "pdf",
          fileName: "lead.pdf",
          mimeType: "application/pdf",
          base64: "JVBERi0x"
        }
      ]
    };

    expect(message.channel).toBe("web");
    expect(message.attachments[0]?.kind).toBe("pdf");
  });
});
