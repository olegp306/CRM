import type { ExecuteAssistantActionResult } from "./action-execution";
import type { AssistantChannel } from "./channel-message";
import { createLeadMatchDetectedEvent, type AssistantChannelEvent } from "./channel-event";

export type CreateExecutionChannelEventsInput = {
  channel: AssistantChannel;
  threadId: string;
  execution: ExecuteAssistantActionResult;
};

export function createExecutionChannelEvents({
  channel,
  threadId,
  execution
}: CreateExecutionChannelEventsInput): AssistantChannelEvent[] {
  if (!("actionType" in execution)) {
    return [];
  }

  if (execution.actionType === "duplicate_lead") {
    return [
      createLeadMatchDetectedEvent({
        type: "lead_match_detected",
        channel,
        threadId,
        leadId: execution.leadId,
        matchType: "duplicate",
        matchedFields: []
      })
    ];
  }

  if (execution.actionType === "existing_lead_match" || execution.actionType === "needs_clarification") {
    return [
      createLeadMatchDetectedEvent({
        type: "lead_match_detected",
        channel,
        threadId,
        leadId: execution.leadId,
        matchType: execution.actionType === "existing_lead_match" ? "likely_update" : "needs_clarification",
        matchedFields: execution.matchedFields
      })
    ];
  }

  return [];
}
