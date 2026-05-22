"use server";

import {
  createAuditEventsCsv,
  createAuditReviewSummary,
  createPlatformInboxSummary,
  createAssistantPersistenceDraft,
  createAssistantSubmissionResult,
  createOpenAIAssistantSubmissionResult,
  createOnboardingConversationFeedbackContent,
  createPlatformFeedbackBulkUpdatePlan,
  createPlatformFeedbackCsv,
  executeAssistantAction,
  filterAuditEvents,
  type AuditReviewFilters,
  type AssistantContext,
  type FeedbackTriageEvent,
  type PlatformFeedbackFilters
} from "@app/assistant";
import { generateAssistantKpDocument } from "./document-execution-store";
import { createAssistantFollowup } from "./followup-execution-store";
import { createAssistantLead, listAssistantCreatedLeads, markAssistantLeadKpSent } from "./lead-execution-store";
import { updateAssistantProjectTask } from "./project-task-execution-store";
import { getAssistantRepository } from "./repository";

export type SubmitAssistantMessageInput = {
  context: AssistantContext;
  content: string;
  threadId: string;
  messageId: string;
};

export type SubmitOnboardingAssistantMessageInput = SubmitAssistantMessageInput;

export async function submitAssistantMessageAction(input: SubmitAssistantMessageInput) {
  const result = await createOpenAIAssistantSubmissionResult(input, {
    apiKey: getRequiredOpenAiApiKey(),
    model: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini"
  });
  const persistenceDraft = createAssistantPersistenceDraft(result, {
    threadId: input.threadId,
    messageId: input.messageId
  });
  const repository = getAssistantRepository();

  repository.save(persistenceDraft);
  const [threads, messages, feedback, actions] = await Promise.all([
    repository.listThreads(input.context.workspaceId),
    repository.listMessages(input.threadId),
    repository.listFeedback(input.context.workspaceId),
    repository.listActions(input.context.workspaceId)
  ]);

  return {
    result,
    persistenceDraft,
    saved: {
      threadCount: threads.length,
      messageCount: messages.length,
      feedbackCount: feedback.length,
      actionCount: actions.length
    }
  };
}

export async function submitOnboardingAssistantMessageAction(input: SubmitOnboardingAssistantMessageInput) {
  const context: AssistantContext = {
    ...input.context,
    route: "/assistant",
    module: "onboarding"
  };
  const result = createAssistantSubmissionResult({
    context,
    content: createOnboardingConversationFeedbackContent(input.content),
    threadId: input.threadId,
    messageId: input.messageId
  });
  const persistenceDraft = createAssistantPersistenceDraft(result, {
    threadId: input.threadId,
    messageId: input.messageId
  });
  const repository = getAssistantRepository();

  await repository.save(persistenceDraft);
  const [threads, messages, feedback, actions] = await Promise.all([
    repository.listThreads(context.workspaceId),
    repository.listMessages(input.threadId),
    repository.listFeedback(context.workspaceId),
    repository.listActions(context.workspaceId)
  ]);

  return {
    result,
    displayUserContent: input.content,
    persistenceDraft,
    saved: {
      threadCount: threads.length,
      messageCount: messages.length,
      feedbackCount: feedback.length,
      actionCount: actions.length
    }
  };
}

function getRequiredOpenAiApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for the assistant runtime.");
  }

  return apiKey;
}

export async function listAssistantWorkspaceMemoryAction(workspaceId: string) {
  const repository = getAssistantRepository();

  return {
    threads: await repository.listThreads(workspaceId),
    feedback: await repository.listFeedback(workspaceId),
    actions: await repository.listActions(workspaceId)
  };
}

export async function getPlatformInboxSummaryAction(workspaceId: string, filters: PlatformFeedbackFilters = {}) {
  const repository = getAssistantRepository();
  const [feedback, actions] = await Promise.all([
    repository.listFeedback(workspaceId, filters),
    repository.listActions(workspaceId)
  ]);

  return createPlatformInboxSummary({
    feedback,
    actions
  });
}

export async function exportPlatformFeedbackCsvAction(workspaceId: string, filters: PlatformFeedbackFilters = {}) {
  const feedback = await getAssistantRepository().listFeedback(workspaceId, filters);

  return createPlatformFeedbackCsv(feedback);
}

export async function bulkUpdateFeedbackStatusAction({
  workspaceId,
  filters = {},
  event
}: {
  workspaceId: string;
  filters?: PlatformFeedbackFilters;
  event: FeedbackTriageEvent;
}) {
  const repository = getAssistantRepository();
  const feedback = await repository.listFeedback(workspaceId, filters);
  const plan = createPlatformFeedbackBulkUpdatePlan(feedback, event);
  const updates = await Promise.all(
    plan.items.map((item) => repository.updateFeedbackStatus(item.workspaceId, item.sourceMessageId, event))
  );

  return {
    plan,
    updatedCount: updates.filter(Boolean).length,
    summary: await getPlatformInboxSummaryAction(workspaceId, filters)
  };
}

export async function listAssistantAuditEventsAction(workspaceId: string, filters: AuditReviewFilters = {}) {
  return filterAuditEvents(await getAssistantRepository().listAuditEvents(workspaceId), filters);
}

export async function getPlatformAuditReviewAction(workspaceId: string, filters: AuditReviewFilters = {}) {
  const events = await listAssistantAuditEventsAction(workspaceId, filters);

  return {
    events,
    summary: createAuditReviewSummary(events)
  };
}

export async function exportPlatformAuditCsvAction(workspaceId: string, filters: AuditReviewFilters = {}) {
  const events = await listAssistantAuditEventsAction(workspaceId, filters);

  return createAuditEventsCsv(events);
}

export async function updateFeedbackStatusAction({
  workspaceId,
  sourceMessageId,
  event
}: {
  workspaceId: string;
  sourceMessageId: string;
  event: FeedbackTriageEvent;
}) {
  const updated = await getAssistantRepository().updateFeedbackStatus(workspaceId, sourceMessageId, event);

  return {
    updated,
    summary: await getPlatformInboxSummaryAction(workspaceId)
  };
}

export async function confirmAssistantActionAction({
  workspaceId,
  messageId
}: {
  workspaceId: string;
  messageId: string;
}) {
  const repository = getAssistantRepository();
  const action = (await repository.listActions(workspaceId)).find((item) => item.messageId === messageId);

  if (!action) {
    throw new Error(`Assistant action ${messageId} was not found`);
  }

  const execution = await executeAssistantAction({
    action,
    now: new Date(),
    existingLeadIds: (await listAssistantCreatedLeads(workspaceId)).map((lead) => lead.leadId),
    createLead: createAssistantLead,
    scheduleFollowup: createAssistantFollowup,
    updateProjectTask: updateAssistantProjectTask,
    generateKpDocument: generateAssistantKpDocument,
    markKpSent: markAssistantLeadKpSent
  });

  const updatedAction = await repository.updateActionExecutionResult(workspaceId, messageId, {
    status: execution.status,
    result: execution
  });

  return {
    execution,
    action: updatedAction,
    leads: await listAssistantCreatedLeads(workspaceId)
  };
}
