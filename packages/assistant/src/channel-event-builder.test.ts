import { describe, expect, it } from "vitest";
import { createInboundMessageChannelEvents } from "./channel-event-builder";

describe("inbound message channel events", () => {
  it("creates a lead interaction note when a selected lead message is an explicit note command", () => {
    const events = createInboundMessageChannelEvents({
      channel: "web",
      threadId: "thread-1",
      messageId: "message-1",
      leadId: "L-2026-044",
      content: "Record that we sent the client a birthday gift."
    });

    expect(events).toEqual([
      {
        type: "message_received",
        channel: "web",
        threadId: "thread-1",
        messageId: "message-1",
        leadId: "L-2026-044",
        summary: "Record that we sent the client a birthday gift."
      },
      {
        type: "lead_interaction_note",
        channel: "web",
        threadId: "thread-1",
        messageId: "message-1",
        leadId: "L-2026-044",
        summary: "we sent the client a birthday gift."
      }
    ]);
  });

  it("keeps regular selected lead questions as message-only events", () => {
    const events = createInboundMessageChannelEvents({
      channel: "web",
      threadId: "thread-1",
      messageId: "message-2",
      leadId: "L-2026-044",
      content: "What is waiting next for this lead?"
    });

    expect(events).toEqual([
      {
        type: "message_received",
        channel: "web",
        threadId: "thread-1",
        messageId: "message-2",
        leadId: "L-2026-044",
        summary: "What is waiting next for this lead?"
      }
    ]);
  });

  it("stores selected lead reminder requests as readable history notes", () => {
    const events = createInboundMessageChannelEvents({
      channel: "telegram",
      threadId: "telegram-1",
      messageId: "message-3",
      leadId: "L-2026-044",
      content: "Напомни завтра посмотреть LinkedIn у него"
    });

    expect(events).toContainEqual({
      type: "lead_interaction_note",
      channel: "telegram",
      threadId: "telegram-1",
      messageId: "message-3",
      leadId: "L-2026-044",
      summary: "Reminder requested: Напомни завтра посмотреть LinkedIn у него"
    });
  });
});
