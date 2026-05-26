import { describe, expect, it } from "vitest";
import {
  createKpGeneratedEvent,
  createKpSentMarkedEvent,
  createKpSentUndoneEvent,
  createLeadInteractionNoteEvent,
  createLeadCreatedEvent,
  createLeadDraftUpdatedEvent,
  createLeadMatchDetectedEvent,
  createMessageReceivedEvent
} from "./channel-event";

describe("assistant channel events", () => {
  it("creates comparable Telegram lead creation events", () => {
    expect([
      createMessageReceivedEvent({
        type: "message_received",
        channel: "telegram",
        threadId: "telegram:123",
        messageId: "42",
        leadId: "L-2026-035",
        summary: "Client sent source material"
      }),
      createLeadCreatedEvent({
        type: "lead_created",
        channel: "telegram",
        threadId: "telegram:123",
        leadId: "L-2026-035",
        fieldsCreated: ["clientName", "projectAddress"],
        missingData: []
      }),
      createKpGeneratedEvent({
        type: "kp_generated",
        channel: "telegram",
        threadId: "telegram:123",
        leadId: "L-2026-035",
        documentId: "D-telegram-123-42"
      })
    ]).toEqual([
      {
        type: "message_received",
        channel: "telegram",
        threadId: "telegram:123",
        messageId: "42",
        leadId: "L-2026-035",
        summary: "Client sent source material"
      },
      {
        type: "lead_created",
        channel: "telegram",
        threadId: "telegram:123",
        leadId: "L-2026-035",
        fieldsCreated: ["clientName", "projectAddress"],
        missingData: []
      },
      {
        type: "kp_generated",
        channel: "telegram",
        threadId: "telegram:123",
        leadId: "L-2026-035",
        documentId: "D-telegram-123-42"
      }
    ]);
  });

  it("creates comparable Web draft and KP status events", () => {
    expect([
      createLeadDraftUpdatedEvent({
        type: "lead_draft_updated",
        channel: "web",
        threadId: "thread-1",
        leadId: "L-2026-004",
        fieldsChanged: ["projectAddress"],
        missingData: ["bgfM2"]
      }),
      createKpSentMarkedEvent({ type: "kp_sent_marked", channel: "web", threadId: "thread-1", leadId: "L-2026-004" }),
      createKpSentUndoneEvent({ type: "kp_sent_undone", channel: "web", threadId: "thread-1", leadId: "L-2026-004" })
    ]).toEqual([
      {
        type: "lead_draft_updated",
        channel: "web",
        threadId: "thread-1",
        leadId: "L-2026-004",
        fieldsChanged: ["projectAddress"],
        missingData: ["bgfM2"]
      },
      { type: "kp_sent_marked", channel: "web", threadId: "thread-1", leadId: "L-2026-004" },
      { type: "kp_sent_undone", channel: "web", threadId: "thread-1", leadId: "L-2026-004" }
    ]);
  });

  it("creates lead interaction note events for human Telegram notes", () => {
    expect(
      createLeadInteractionNoteEvent({
        type: "lead_interaction_note",
        channel: "telegram",
        threadId: "telegram:12345",
        leadId: "L-2026-004",
        messageId: "92",
        summary: "Sent the client a birthday gift"
      })
    ).toEqual({
      type: "lead_interaction_note",
      channel: "telegram",
      threadId: "telegram:12345",
      leadId: "L-2026-004",
      messageId: "92",
      summary: "Sent the client a birthday gift"
    });
  });

  it("creates lead match detected events for duplicate prevention and clarification", () => {
    expect(
      createLeadMatchDetectedEvent({
        type: "lead_match_detected",
        channel: "web",
        threadId: "thread-1",
        leadId: "L-2026-004",
        matchType: "needs_clarification",
        matchedFields: ["projectAddress"]
      })
    ).toEqual({
      type: "lead_match_detected",
      channel: "web",
      threadId: "thread-1",
      leadId: "L-2026-004",
      matchType: "needs_clarification",
      matchedFields: ["projectAddress"]
    });
  });
});
