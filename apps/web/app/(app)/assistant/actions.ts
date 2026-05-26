"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  createAuditEventsCsv,
  createAuditReviewSummary,
  createPlatformInboxSummary,
  createAssistantPersistenceDraft,
  createKpGeneratedEvent,
  createKpSentMarkedEvent,
  createKpSentUndoneEvent,
  createLeadCreatedEvent,
  createAssistantSubmissionResult,
  createAssistantMessageDraft,
  createMessageReceivedEvent,
  createAssistantThreadDraft,
  createOpenAIAssistantSubmissionResult,
  createOnboardingConversationFeedbackContent,
  createRussianOnboardingAssistantMessage,
  createPlatformFeedbackBulkUpdatePlan,
  createPlatformFeedbackCsv,
  createPlatformReleaseActionPlan,
  createPlatformReleaseHistory,
  createPlatformReleaseHistoryCsv,
  createPlatformReleaseHistorySummary,
  createPlatformReleasePlanningAuditEvent,
  executeAssistantAction,
  filterAuditEvents,
  isTranslationOrLanguageSwitchRequest,
  createPlatformReleaseNotesDraft,
  createPlatformReleaseReadiness,
  createPlatformReleaseTriage,
  createPlatformReleaseWorkflow,
  type AuditReviewFilters,
  type AssistantChannelAttachment,
  type AssistantContext,
  type AssistantSubmissionResult,
  type FeedbackTriageEvent,
  type PlatformFeedbackFilters
} from "@app/assistant";
import { generateAssistantKpDocument, listAssistantGeneratedDocuments } from "./document-execution-store";
import { createAssistantFollowup } from "./followup-execution-store";
import { createAssistantLead, listAssistantCreatedLeads, markAssistantLeadKpSent, undoAssistantLeadKpSent } from "./lead-execution-store";
import { updateAssistantProjectTask } from "./project-task-execution-store";
import { getAssistantRepository } from "./repository";
import { createSelectedLeadChatSnapshot } from "./selected-lead-snapshot";

export type SubmitAssistantMessageInput = {
  context: AssistantContext;
  content: string;
  threadId: string;
  messageId: string;
  attachments?: AssistantChannelAttachment[];
};

export type SubmitOnboardingAssistantMessageInput = SubmitAssistantMessageInput;

const assistantThemePreferences = new Set(["light", "dark", "nocturne", "graphite", "warm"]);

export async function submitAssistantMessageAction(input: SubmitAssistantMessageInput) {
  const selectedLeadId = input.context.selectedRecordIds?.[0];
  const [leads, generatedDocuments] = selectedLeadId
    ? await Promise.all([listAssistantCreatedLeads(input.context.workspaceId), listAssistantGeneratedDocuments(input.context.workspaceId)])
    : [[], []];
  const selectedLead = selectedLeadId ? createSelectedLeadChatSnapshot(selectedLeadId, leads, generatedDocuments) : null;
  const result = await createOpenAIAssistantSubmissionResult(
    {
      ...input,
      attachments: input.attachments ?? [],
      lead: selectedLead
    },
    {
      apiKey: process.env.OPENAI_API_KEY?.trim() ?? "",
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini"
    }
  );
  const persistenceDraft = createAssistantPersistenceDraft(
    result,
    {
      threadId: input.threadId,
      messageId: input.messageId
    },
    {
      channelEvents: [
        createMessageReceivedEvent({
          type: "message_received",
          channel: "web",
          threadId: input.threadId,
          messageId: input.messageId,
          leadId: input.context.selectedRecordIds?.[0],
          summary: input.content.trim()
        })
      ]
    }
  );
  const repository = getAssistantRepository();

  await repository.save(persistenceDraft);
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
  const result = isTranslationOrLanguageSwitchRequest(input.content)
    ? createOnboardingTranslationResult({
        context,
        content: input.content,
        threadId: input.threadId,
        messageId: input.messageId,
        attachments: input.attachments ?? []
      })
    : createAssistantSubmissionResult({
        context,
        content: createOnboardingConversationFeedbackContent(input.content),
        threadId: input.threadId,
        messageId: input.messageId,
        attachments: input.attachments ?? []
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

export async function setAssistantThemePreferenceAction(themePreference: string) {
  const normalized = themePreference.trim();

  if (!assistantThemePreferences.has(normalized)) {
    throw new Error("Unsupported CRM theme preference.");
  }

  const cookieStore = await cookies();
  cookieStore.set("crm_theme_preference", normalized, { path: "/", sameSite: "lax" });
  revalidatePath("/");
  revalidatePath("/settings/branding");

  return {
    themePreference: normalized,
    summary: `Theme switched to ${normalized}.`
  };
}

function createOnboardingTranslationResult({
  context,
  content,
  threadId,
  messageId
}: SubmitAssistantMessageInput): AssistantSubmissionResult {
  const message = createAssistantMessageDraft({
    threadId,
    userId: context.userId,
    role: "user",
    content: content.trim(),
    context
  });

  return {
    thread: createAssistantThreadDraft({
      context,
      title: "Translate onboarding to Russian"
    }),
    message: {
      ...message,
      intent: "other"
    },
    response: createRussianOnboardingAssistantMessage(),
    feedback: null,
    actionPreview: null,
    responseButtons: [],
    confirmationStatus: null,
    permissionBlocked: null
  };
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
  const [feedback, allFeedback, actions, auditEvents] = await Promise.all([
    repository.listFeedback(workspaceId, filters),
    repository.listFeedback(workspaceId),
    repository.listActions(workspaceId),
    repository.listAuditEvents(workspaceId)
  ]);
  const feedbackMessages = (
    await Promise.all(
      Array.from(new Set(feedback.map((item) => item.sourceThreadId))).map((threadId) => repository.listMessages(threadId))
    )
  ).flat();

  const releaseTriage = createPlatformReleaseTriage(allFeedback);
  const releaseHistory = createPlatformReleaseHistory(auditEvents, filters.appVersion ? { appVersion: filters.appVersion } : {});

  return {
    ...createPlatformInboxSummary({
      feedback,
      actions,
      messages: feedbackMessages
    }),
    releaseTriage: releaseTriage,
    releaseNotesDrafts: releaseTriage.map((release) => createPlatformReleaseNotesDraft(release.appVersion, allFeedback)),
    releaseReadiness: releaseTriage.map((release) => createPlatformReleaseReadiness(release.appVersion, allFeedback)),
    releaseWorkflows: releaseTriage.map((release) => createPlatformReleaseWorkflow(release.appVersion, allFeedback)),
    releaseHistory: releaseHistory,
    releaseHistorySummary: createPlatformReleaseHistorySummary(releaseHistory)
  };
}

export async function exportPlatformFeedbackCsvAction(workspaceId: string, filters: PlatformFeedbackFilters = {}) {
  const feedback = await getAssistantRepository().listFeedback(workspaceId, filters);

  return createPlatformFeedbackCsv(feedback);
}

export async function exportPlatformReleaseHistoryCsvAction(
  workspaceId: string,
  filters: Pick<PlatformFeedbackFilters, "appVersion"> = {}
) {
  const auditEvents = await getAssistantRepository().listAuditEvents(workspaceId);

  return createPlatformReleaseHistoryCsv(createPlatformReleaseHistory(auditEvents, filters));
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

export async function planReleaseFeedbackAction({
  workspaceId,
  actorUserId,
  appVersion
}: {
  workspaceId: string;
  actorUserId?: string;
  appVersion: string;
}) {
  const repository = getAssistantRepository();
  const feedback = await repository.listFeedback(workspaceId);
  const plan = createPlatformReleaseActionPlan(feedback, { appVersion, event: "plan" });
  const updates = await Promise.all(
    plan.items.map((item) => repository.updateFeedbackStatus(item.workspaceId, item.sourceMessageId, plan.event))
  );
  const updatedCount = updates.filter(Boolean).length;

  await repository.saveAuditEvent(
    createPlatformReleasePlanningAuditEvent({
      workspaceId,
      actorUserId,
      appVersion,
      plannedCount: updatedCount,
      skippedCount: plan.skippedCount
    })
  );

  return {
    plan,
    updatedCount,
    summary: await getPlatformInboxSummaryAction(workspaceId, { appVersion })
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
    markKpSent: markAssistantLeadKpSent,
    undoKpSent: undoAssistantLeadKpSent
  });

  const updatedAction = await repository.updateActionExecutionResult(workspaceId, messageId, {
    status: execution.status,
    result: execution
  });
  const executionChannelEvents = createWebExecutionChannelEvents(action.threadId, execution);
  await Promise.all(
    executionChannelEvents.map((event) =>
      repository.saveAuditEvent({
        workspaceId,
        actorUserId: action.requestedByUserId,
        action: "assistant.channel.event",
        targetType: "AssistantChannelEvent",
        targetId: `${event.channel}:${event.type}:${event.threadId}:${"leadId" in event ? event.leadId : "documentId" in event ? event.documentId : messageId}`,
        metadata: event
      })
    )
  );

  return {
    execution,
    action: updatedAction,
    leads: await listAssistantCreatedLeads(workspaceId)
  };
}

function createWebExecutionChannelEvents(threadId: string, execution: Awaited<ReturnType<typeof executeAssistantAction>>) {
  if ("actionType" in execution) {
    if (execution.actionType === "mark_kp_sent") {
      return [createKpSentMarkedEvent({ type: "kp_sent_marked", channel: "web", threadId, leadId: execution.leadId })];
    }

    if (execution.actionType === "undo_kp_sent") {
      return [createKpSentUndoneEvent({ type: "kp_sent_undone", channel: "web", threadId, leadId: execution.leadId })];
    }

    if (execution.actionType === "generate_kp") {
      return [];
    }

    return [];
  }

  return [
    createLeadCreatedEvent({
      type: "lead_created",
      channel: "web",
      threadId,
      leadId: execution.leadId,
      fieldsCreated: ["rawInput"],
      missingData: []
    }),
    ...(execution.documentId
      ? [
          createKpGeneratedEvent({
            type: "kp_generated",
            channel: "web",
            threadId,
            leadId: execution.leadId,
            documentId: execution.documentId
          })
        ]
      : [])
  ];
}
