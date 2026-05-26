import {
  createLeadInteractionNoteEvent,
  createMessageReceivedEvent,
  type AssistantChannelEvent
} from "./channel-event";
import { createLeadInteractionNoteSummary, isLeadInteractionNoteCommand } from "./lead-interaction-note";
import { createReminderHistorySummary, isReminderRequest } from "./lead-reminder";

export type CreateInboundMessageChannelEventsInput = {
  channel: "web" | "telegram";
  threadId: string;
  messageId: string;
  content: string;
  leadId?: string;
};

export function createInboundMessageChannelEvents({
  channel,
  threadId,
  messageId,
  content,
  leadId
}: CreateInboundMessageChannelEventsInput): AssistantChannelEvent[] {
  const summary = content.trim();
  const events: AssistantChannelEvent[] = [
    createMessageReceivedEvent({
      type: "message_received",
      channel,
      threadId,
      messageId,
      leadId,
      summary
    })
  ];

  if (leadId && isLeadInteractionNoteCommand(summary)) {
    events.push(
      createLeadInteractionNoteEvent({
        type: "lead_interaction_note",
        channel,
        threadId,
        messageId,
        leadId,
        summary: createLeadInteractionNoteSummary(summary)
      })
    );
  } else if (leadId && isReminderRequest(summary)) {
    events.push(
      createLeadInteractionNoteEvent({
        type: "lead_interaction_note",
        channel,
        threadId,
        messageId,
        leadId,
        summary: createReminderHistorySummary(summary)
      })
    );
  }

  return events;
}
