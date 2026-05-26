export type AssistantChannelEvent =
  | {
      type: "message_received";
      channel: "web" | "telegram";
      threadId: string;
      messageId: string;
      leadId?: string;
      summary: string;
    }
  | {
      type: "lead_draft_updated";
      channel: "web" | "telegram";
      threadId: string;
      leadId?: string;
      fieldsChanged: string[];
      missingData: string[];
    }
  | {
      type: "lead_created";
      channel: "web" | "telegram";
      threadId: string;
      leadId: string;
      fieldsCreated: string[];
      missingData: string[];
    }
  | {
      type: "kp_generated";
      channel: "web" | "telegram";
      threadId: string;
      leadId: string;
      documentId: string;
    }
  | {
      type: "kp_sent_marked";
      channel: "web" | "telegram";
      threadId: string;
      leadId: string;
    }
  | {
      type: "kp_sent_undone";
      channel: "web" | "telegram";
      threadId: string;
      leadId: string;
    };

export function createMessageReceivedEvent(input: Extract<AssistantChannelEvent, { type: "message_received" }>): AssistantChannelEvent {
  return { ...input };
}

export function createLeadDraftUpdatedEvent(
  input: Extract<AssistantChannelEvent, { type: "lead_draft_updated" }>
): AssistantChannelEvent {
  return { ...input };
}

export function createLeadCreatedEvent(input: Extract<AssistantChannelEvent, { type: "lead_created" }>): AssistantChannelEvent {
  return { ...input };
}

export function createKpGeneratedEvent(input: Extract<AssistantChannelEvent, { type: "kp_generated" }>): AssistantChannelEvent {
  return { ...input };
}

export function createKpSentMarkedEvent(input: Extract<AssistantChannelEvent, { type: "kp_sent_marked" }>): AssistantChannelEvent {
  return { ...input };
}

export function createKpSentUndoneEvent(input: Extract<AssistantChannelEvent, { type: "kp_sent_undone" }>): AssistantChannelEvent {
  return { ...input };
}
