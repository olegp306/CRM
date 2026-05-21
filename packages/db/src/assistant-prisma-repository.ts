import type {
  AssistantActionWriteDraft,
  AssistantAuditEventDraft,
  AssistantMessageWriteDraft,
  AssistantRepositoryContract,
  AssistantThreadWriteDraft,
  FeedbackItemDraft,
  FeedbackItemIntent,
  FeedbackItemStatus,
  FeedbackTriageEvent,
  PlatformFeedbackFilters
} from "@app/assistant";
import { createAssistantActionExecutionAuditEvent, transitionFeedbackStatus } from "@app/assistant";
import { createAssistantPrismaWritePlan } from "./assistant-write-plan";

type JsonRow = Record<string, unknown>;

type PrismaModel<TRow = unknown> = {
  findMany(args: unknown): Promise<TRow[]>;
};

export type AssistantPrismaClientLike = {
  assistantThread: PrismaModel & {
    upsert(args: unknown): Promise<unknown>;
  };
  assistantMessage: PrismaModel & {
    create(args: unknown): Promise<unknown>;
  };
  feedbackItem: PrismaModel<JsonRow> & {
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  assistantAction: PrismaModel & {
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  auditLog: PrismaModel & {
    createMany(args: unknown): Promise<unknown>;
  };
  $transaction(operations: Promise<unknown>[]): Promise<unknown[]>;
};

export function createAssistantPrismaRepository(client: AssistantPrismaClientLike): AssistantRepositoryContract {
  return {
    async save(draft) {
      const plan = createAssistantPrismaWritePlan(draft);
      const operations: Promise<unknown>[] = [
        client.assistantThread.upsert(plan.threadUpsert),
        client.assistantMessage.create({ data: plan.messageCreate })
      ];

      if (plan.feedbackCreate) {
        operations.push(client.feedbackItem.create({ data: plan.feedbackCreate }));
      }

      if (plan.actionCreate) {
        operations.push(client.assistantAction.create({ data: plan.actionCreate }));
      }

      operations.push(client.auditLog.createMany({ data: plan.auditCreateManyData }));

      await client.$transaction(operations);
    },

    async listThreads(workspaceId) {
      const rows = await client.assistantThread.findMany({
        where: { workspaceId },
        orderBy: { updatedAt: "desc" }
      });

      return rows as AssistantThreadWriteDraft[];
    },

    async listMessages(threadId) {
      const rows = await client.assistantMessage.findMany({
        where: { threadId },
        orderBy: { createdAt: "asc" }
      });

      return rows as AssistantMessageWriteDraft[];
    },

    async listFeedback(workspaceId, filters: PlatformFeedbackFilters = {}) {
      const rows = await client.feedbackItem.findMany({
        where: {
          workspaceId,
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.type ? { type: filters.type } : {}),
          ...(filters.appVersion ? { appVersion: filters.appVersion } : {})
        },
        orderBy: { updatedAt: "desc" }
      });

      return rows.map(toFeedbackItemDraft);
    },

    async updateFeedbackStatus(workspaceId, sourceMessageId, event: FeedbackTriageEvent) {
      const [current] = await client.feedbackItem.findMany({
        where: { workspaceId, sourceMessageId },
        take: 1
      });

      if (!current) {
        return null;
      }

      const nextStatus = transitionFeedbackStatus(current.status as FeedbackItemStatus, event);

      await client.feedbackItem.update({
        where: {
          sourceThreadId_sourceMessageId: {
            sourceThreadId: current.sourceThreadId,
            sourceMessageId: current.sourceMessageId
          }
        },
        data: { status: nextStatus }
      });

      return toFeedbackItemDraft({ ...current, status: nextStatus });
    },

    async listActions(workspaceId) {
      const rows = await client.assistantAction.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" }
      });

      return rows as AssistantActionWriteDraft[];
    },

    async updateActionExecutionResult(workspaceId, messageId, update) {
      const row = await client.assistantAction.update({
        where: {
          workspaceId_messageId: {
            workspaceId,
            messageId
          }
        },
        data: update
      });
      const action = row as AssistantActionWriteDraft;

      if (update.status === "executed" || update.status === "failed") {
        await client.auditLog.createMany({
          data: [
            createAssistantActionExecutionAuditEvent({
              workspaceId: action.workspaceId,
              actorUserId: action.requestedByUserId,
              threadId: action.threadId,
              messageId: action.messageId,
              actionType: action.actionType,
              status: update.status,
              result: update.result
            })
          ]
        });
      }

      return action;
    },

    async saveAuditEvent(event) {
      await client.auditLog.createMany({ data: [event] });
    },

    async listAuditEvents(workspaceId) {
      const rows = await client.auditLog.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" }
      });

      return rows as AssistantAuditEventDraft[];
    },

    async clear() {
      throw new Error("Clearing the Prisma assistant repository is not supported");
    }
  };
}

function toFeedbackItemDraft(row: JsonRow): FeedbackItemDraft {
  return {
    workspaceId: String(row.workspaceId),
    sourceThreadId: String(row.sourceThreadId),
    sourceMessageId: String(row.sourceMessageId),
    type: row.type as FeedbackItemIntent,
    status: row.status as FeedbackItemStatus,
    priority: "normal",
    ...(typeof row.moduleContext === "string" ? { moduleContext: row.moduleContext } : {}),
    ...(typeof row.role === "string" ? { role: row.role } : {}),
    appVersion: typeof row.appVersion === "string" ? row.appVersion : "unknown"
  };
}
