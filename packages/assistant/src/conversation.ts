import type { AssistantIntent } from "./classify-intent";
import type { AssistantModuleContext } from "./context";
import type { AssistantSubmissionResult } from "./submission";

export type AssistantConversationEntry = {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent: AssistantIntent;
};

export function getAssistantModuleFromRoute(route: string): AssistantModuleContext {
  if (route.startsWith("/clients")) return "clients";
  if (route.startsWith("/leads")) return "leads";
  if (route.startsWith("/projects")) return "projects";
  if (route.startsWith("/outreach")) return "outreach";
  if (route.startsWith("/content")) return "content";
  if (route.startsWith("/settings")) return "settings";
  if (route.startsWith("/assistant")) return "assistant";
  return "other";
}

export function appendAssistantExchange(
  history: AssistantConversationEntry[],
  result: AssistantSubmissionResult,
  messageId: string
): AssistantConversationEntry[] {
  return [
    ...history,
    {
      id: messageId,
      role: "user",
      content: result.message.content,
      intent: result.message.intent
    },
    {
      id: `${messageId}-response`,
      role: "assistant",
      content: result.response,
      intent: result.message.intent
    }
  ];
}
