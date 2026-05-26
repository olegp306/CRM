import { classifyIntent } from "./classify-intent";
import type { AssistantChannelMessage, AssistantChannelResponse } from "./channel-message";

export function createAssistantChannelResponse(message: AssistantChannelMessage): AssistantChannelResponse {
  const intent = classifyIntent(message.content);

  if (isHelpMessage(message.content, intent)) {
    return {
      intent: "help",
      shouldPersistFeedback: false,
      feedbackType: undefined,
      buttons: [],
      text: createSharedCapabilityMessage(message.channel)
    };
  }

  if (intent === "feature_request" || intent === "bug_report" || intent === "ux_feedback" || intent === "support_request") {
    return {
      intent,
      shouldPersistFeedback: intent !== "support_request",
      feedbackType: intent === "support_request" ? undefined : intent,
      buttons: [],
      text:
        intent === "support_request"
          ? "I can help with leads, KP documents, follow-ups, and CRM status. Ask me about a lead or send source material."
          : "I saved this as product feedback for review."
    };
  }

  const responseIntent = intent === "permission_blocked" ? "other" : intent;

  return {
    intent: responseIntent,
    shouldPersistFeedback: false,
    feedbackType: undefined,
    buttons: [],
    text: "I can help with CRM leads. Send client text, photos, PDFs, or ask about the selected lead."
  };
}

function isHelpMessage(content: string, intent: string): boolean {
  return intent === "support_request" && /(\/start|\/help|who are you|what can you do|кто ты|что умеешь)/i.test(content);
}

function createSharedCapabilityMessage(channel: "web" | "telegram"): string {
  const uploadHint =
    channel === "web"
      ? "In the web app, you can also attach files and photos here. On mobile, use your keyboard microphone for voice dictation."
      : "In Telegram, reply to a lead card to update that exact lead.";

  return [
    "Hi, I am Oleg's CRM assistant.",
    "I can create and update leads, read source materials, track missing KP fields, prepare KP documents, mark KP as sent, and explain what is waiting next.",
    uploadHint,
    "I only save feature requests when the message is clearly product feedback."
  ].join("\n\n");
}
