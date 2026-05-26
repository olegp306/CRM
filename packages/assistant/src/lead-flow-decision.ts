import { classifyIntent } from "./classify-intent";
import { createCapabilityResponse } from "./capability-registry";
import type { AssistantChannelMessage } from "./channel-message";
import { isLeadChatSourceMaterial, isNewLeadCommand } from "./lead-chat-orchestrator";
import { isReminderRequest } from "./lead-reminder";

export type LeadFlowDecision =
  | {
      kind: "start_draft";
      source: "new_lead_command" | "source_material";
    }
  | {
      kind: "update_existing_lead";
      leadId: string;
      source: "reply" | "selected_record" | "explicit_id";
    }
  | {
      kind: "possible_different_lead";
      leadId: string;
      reason: string;
    }
  | {
      kind: "not_lead_flow";
    };

export function decideLeadFlow(message: AssistantChannelMessage): LeadFlowDecision {
  if (createCapabilityResponse(message)) {
    return { kind: "not_lead_flow" };
  }

  if (isNewLeadCommand(message.content)) {
    return { kind: "start_draft", source: "new_lead_command" };
  }

  if (isReminderRequest(message.content)) {
    return { kind: "not_lead_flow" };
  }

  const intent = classifyIntent(message.content);
  if (
    intent === "support_request" ||
    intent === "bug_report" ||
    intent === "feature_request" ||
    intent === "ux_feedback" ||
    isLeadContextSupportRequest(message)
  ) {
    return { kind: "not_lead_flow" };
  }

  if (message.replyTo?.leadId) {
    return { kind: "update_existing_lead", leadId: message.replyTo.leadId, source: "reply" };
  }

  const explicitLeadId = getExplicitLeadId(message.content);
  if (explicitLeadId && isLeadChatSourceMaterial(message)) {
    return { kind: "update_existing_lead", leadId: explicitLeadId, source: "explicit_id" };
  }

  const selectedLeadId = getSelectedLeadId(message);
  if (selectedLeadId && isLeadChatSourceMaterial(message)) {
    return { kind: "update_existing_lead", leadId: selectedLeadId, source: "selected_record" };
  }

  if (isLeadChatSourceMaterial(message)) {
    return { kind: "start_draft", source: "source_material" };
  }

  return { kind: "not_lead_flow" };
}

function getExplicitLeadId(content: string): string | null {
  return /\bL-\d{4}-\d+\b/i.exec(content)?.[0]?.toUpperCase() ?? null;
}

function getSelectedLeadId(message: AssistantChannelMessage): string | null {
  return message.context.selectedRecordIds?.find((id) => /^L-\d{4}-\d+$/i.test(id)) ?? null;
}

function isLeadContextSupportRequest(message: AssistantChannelMessage): boolean {
  if (!message.replyTo?.leadId && !getSelectedLeadId(message)) {
    return false;
  }

  return /\b(status|help|what(?:'s| is)?\s+(?:next|waiting|status)|where\s+is|check|ready)\b|статус|что дальше|что ждем|проверь|готов/i.test(
    message.content
  );
}
