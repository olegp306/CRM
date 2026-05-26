import { describe, expect, it } from "vitest";
import type { AssistantContext, AssistantPersistenceDraft } from "@app/assistant";
import { createAssistantPersistenceDraft, createAssistantSubmissionResult, createPlatformReleasePlanningAuditEvent } from "@app/assistant";
import { createAssistantPrismaRepository, type AssistantPrismaClientLike } from "./assistant-prisma-repository";

type Call = {
  model: string;
  method: string;
  args: unknown;
};

type RowMap = Partial<
  Record<"assistantThread" | "assistantMessage" | "feedbackItem" | "assistantAction" | "auditLog", Record<string, unknown>[]>
>;

const context: AssistantContext = {
  workspaceId: "workspace-1",
  userId: "user-1",
  role: "admin",
  route: "/leads",
  module: "leads",
  selectedRecordIds: ["lead-1"]
};

function createDraft(content: string, threadId = "thread-1", messageId = "message-1"): AssistantPersistenceDraft {
  return createAssistantPersistenceDraft(
    createAssistantSubmissionResult({
      context,
      content,
      threadId,
      messageId
    }),
    { threadId, messageId }
  );
}

function createFakeClient(rows: RowMap = {}) {
  const calls: Call[] = [];

  const record = <T>(model: string, method: string, args: unknown, result: T): Promise<T> => {
    calls.push({ model, method, args });
    return Promise.resolve(result);
  };

  const client: AssistantPrismaClientLike = {
    assistantThread: {
      upsert: (args) => record("assistantThread", "upsert", args, { id: "thread-1" }),
      findMany: (args) => record("assistantThread", "findMany", args, rows.assistantThread ?? [])
    },
    assistantMessage: {
      create: (args) => record("assistantMessage", "create", args, { id: "message-1" }),
      findMany: (args) => record("assistantMessage", "findMany", args, rows.assistantMessage ?? [])
    },
    feedbackItem: {
      create: (args) => record("feedbackItem", "create", args, { id: "feedback-1" }),
      findMany: (args) => record("feedbackItem", "findMany", args, rows.feedbackItem ?? []),
      update: (args) => record("feedbackItem", "update", args, rows.feedbackItem?.[0] ?? null)
    },
    assistantAction: {
      create: (args) => record("assistantAction", "create", args, { id: "action-1" }),
      findMany: (args) => record("assistantAction", "findMany", args, rows.assistantAction ?? []),
      update: (args) => record("assistantAction", "update", args, rows.assistantAction?.[0] ?? null)
    },
    auditLog: {
      createMany: (args) => record("auditLog", "createMany", args, { count: 1 }),
      findMany: (args) => record("auditLog", "findMany", args, rows.auditLog ?? [])
    },
    $transaction: async (operations) => {
      calls.push({ model: "$transaction", method: "run", args: operations.length });
      return Promise.all(operations);
    }
  };

  return { client, calls };
}

describe("assistant Prisma repository", () => {
  it("persists assistant drafts through one Prisma transaction", async () => {
    const { client, calls } = createFakeClient();
    const repository = createAssistantPrismaRepository(client);

    await repository.save(createDraft("Create lead Anna Beispiel"));

    expect(calls.map((call) => `${call.model}.${call.method}`)).toEqual([
      "assistantThread.upsert",
      "assistantMessage.create",
      "assistantAction.create",
      "auditLog.createMany",
      "$transaction.run"
    ]);
    expect(calls[0]?.args).toMatchObject({
      where: { id: "thread-1" },
      create: { workspaceId: "workspace-1", createdByUserId: "user-1" }
    });
    expect(calls[2]?.args).toMatchObject({
      data: {
        workspaceId: "workspace-1",
        threadId: "thread-1",
        messageId: "message-1",
        actionType: "create_lead",
        status: "awaiting_confirmation"
      }
    });
  });

  it("persists feedback drafts when assistant input creates a feedback item", async () => {
    const { client, calls } = createFakeClient();
    const repository = createAssistantPrismaRepository(client);

    await repository.save(createDraft("Please add mobile filters"));

    expect(calls.map((call) => `${call.model}.${call.method}`)).toEqual([
      "assistantThread.upsert",
      "assistantMessage.create",
      "feedbackItem.create",
      "auditLog.createMany",
      "$transaction.run"
    ]);
    expect(calls[2]?.args).toMatchObject({
      data: {
        workspaceId: "workspace-1",
        sourceThreadId: "thread-1",
        sourceMessageId: "message-1",
        type: "feature_request",
        status: "new",
        appVersion: "0.2.3"
      }
    });
  });

  it("reads repository lists with workspace and chronological ordering", async () => {
    const rows = {
      assistantThread: [{ id: "thread-1", workspaceId: "workspace-1", createdByUserId: "user-1" }],
      assistantMessage: [
        {
          id: "message-1",
          threadId: "thread-1",
          userId: "user-1",
          role: "user",
          content: "Hello",
          context,
          intent: "other"
        }
      ],
      feedbackItem: [
        {
          workspaceId: "workspace-1",
          sourceThreadId: "thread-1",
          sourceMessageId: "message-1",
          type: "feature_request",
          status: "new",
          priority: "normal",
          appVersion: "0.1.0"
        }
      ],
      assistantAction: [
        {
          workspaceId: "workspace-1",
          threadId: "thread-1",
          messageId: "message-1",
          actionType: "create_lead",
          preview: { actionType: "create_lead", label: "Create lead", payload: {} },
          status: "awaiting_confirmation",
          requestedByUserId: "user-1"
        }
      ],
      auditLog: [
        {
          workspaceId: "workspace-1",
          actorUserId: "user-1",
          action: "assistant.message.submitted",
          targetType: "assistant_message",
          targetId: "message-1",
          metadata: {}
        }
      ]
    };
    const { client, calls } = createFakeClient(rows);
    const repository = createAssistantPrismaRepository(client);

    await repository.listThreads("workspace-1");
    await repository.listMessages("thread-1");
    const listedFeedback = await repository.listFeedback("workspace-1");
    await repository.listActions("workspace-1");
    await repository.listAuditEvents("workspace-1");

    expect(listedFeedback).toEqual([
      expect.objectContaining({
        sourceMessageId: "message-1",
        type: "feature_request",
        appVersion: "0.1.0"
      })
    ]);

    expect(calls.map((call) => call.args)).toEqual([
      { where: { workspaceId: "workspace-1" }, orderBy: { updatedAt: "desc" } },
      { where: { threadId: "thread-1" }, orderBy: { createdAt: "asc" } },
      { where: { workspaceId: "workspace-1" }, orderBy: { updatedAt: "desc" } },
      { where: { workspaceId: "workspace-1" }, orderBy: { createdAt: "desc" } },
      { where: { workspaceId: "workspace-1" }, orderBy: { createdAt: "desc" } }
    ]);
  });

  it("passes feedback filters into the Prisma where clause", async () => {
    const { client, calls } = createFakeClient();
    const repository = createAssistantPrismaRepository(client);

    await repository.listFeedback("workspace-1", {
      status: "planned",
      type: "feature_request",
      appVersion: "0.1.0"
    });

    expect(calls[0]?.args).toEqual({
      where: {
        workspaceId: "workspace-1",
        status: "planned",
        type: "feature_request",
        appVersion: "0.1.0"
      },
      orderBy: { updatedAt: "desc" }
    });
  });


  it("updates feedback status from the current row using the source compound key", async () => {
    const { client, calls } = createFakeClient({
      feedbackItem: [
        {
          workspaceId: "workspace-1",
          sourceThreadId: "thread-1",
          sourceMessageId: "message-1",
          type: "feature_request",
          status: "new",
          priority: "normal"
        }
      ]
    });
    const repository = createAssistantPrismaRepository(client);

    await repository.updateFeedbackStatus("workspace-1", "message-1", "plan");

    expect(calls.map((call) => `${call.model}.${call.method}`)).toEqual([
      "feedbackItem.findMany",
      "feedbackItem.update"
    ]);
    expect(calls[1]?.args).toEqual({
      where: {
        sourceThreadId_sourceMessageId: {
          sourceThreadId: "thread-1",
          sourceMessageId: "message-1"
        }
      },
      data: { status: "planned" }
    });
  });

  it("updates action execution result by workspace and message id", async () => {
    const { client, calls } = createFakeClient({
      assistantAction: [
        {
          workspaceId: "workspace-1",
          threadId: "thread-1",
          messageId: "message-1",
          actionType: "create_lead",
          preview: { actionType: "create_lead", changes: [], warnings: [], requiresConfirmation: true },
          status: "awaiting_confirmation",
          requestedByUserId: "user-1"
        }
      ]
    });
    const repository = createAssistantPrismaRepository(client);

    await repository.updateActionExecutionResult("workspace-1", "message-1", {
      status: "executed",
      result: { leadId: "L-2026-001", recordId: "lead-record-1" }
    });

    expect(calls.map((call) => `${call.model}.${call.method}`)).toEqual(["assistantAction.update", "auditLog.createMany"]);
    expect(calls[0]?.args).toEqual({
      where: {
        workspaceId_messageId: {
          workspaceId: "workspace-1",
          messageId: "message-1"
        }
      },
      data: {
        status: "executed",
        result: { leadId: "L-2026-001", recordId: "lead-record-1" }
      }
    });
    expect(calls[1]?.args).toMatchObject({
      data: [
        {
          workspaceId: "workspace-1",
          actorUserId: "user-1",
          action: "assistant.action.executed",
          targetType: "AssistantAction",
          targetId: "message-1"
        }
      ]
    });
  });

  it("persists explicit audit events", async () => {
    const { client, calls } = createFakeClient();
    const repository = createAssistantPrismaRepository(client);

    await repository.saveAuditEvent(
      createPlatformReleasePlanningAuditEvent({
        workspaceId: "workspace-1",
        actorUserId: "user-1",
        appVersion: "0.1.0",
        plannedCount: 2,
        skippedCount: 1
      })
    );

    expect(calls.map((call) => `${call.model}.${call.method}`)).toEqual(["auditLog.createMany"]);
    expect(calls[0]?.args).toMatchObject({
      data: [
        {
          workspaceId: "workspace-1",
          actorUserId: "user-1",
          action: "platform.release.planned",
          targetType: "PlatformRelease",
          targetId: "0.1.0"
        }
      ]
    });
  });
});
