import { classifyIntent, type AssistantIntent } from "./classify-intent";
import type { AssistantContext } from "./context";

export type AssistantThreadDraftInput = {
  context: AssistantContext;
  title?: string;
};

export type AssistantThreadDraft = {
  workspaceId: string;
  createdByUserId: string;
  title?: string;
};

export type AssistantMessageDraftInput = {
  threadId: string;
  userId?: string;
  role: "user" | "assistant" | "system";
  content: string;
  context: AssistantContext;
};

export type AssistantMessageDraft = AssistantMessageDraftInput & {
  intent: AssistantIntent;
};

export function createAssistantThreadDraft({ context, title }: AssistantThreadDraftInput): AssistantThreadDraft {
  return {
    workspaceId: context.workspaceId,
    createdByUserId: context.userId,
    ...(title ? { title } : {})
  };
}

export function createAssistantMessageDraft(input: AssistantMessageDraftInput): AssistantMessageDraft {
  return {
    ...input,
    intent: classifyIntent(input.content)
  };
}
