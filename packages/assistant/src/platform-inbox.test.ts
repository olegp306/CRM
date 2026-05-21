import { describe, expect, it } from "vitest";
import type { AssistantActionWriteDraft } from "./persistence";
import type { FeedbackItemDraft } from "./feedback-item";
import {
  createPlatformFeedbackBulkUpdatePlan,
  createPlatformFeedbackCsv,
  createPlatformInboxSummary,
  createPlatformReleaseActionPlan,
  createPlatformReleaseHistory,
  createPlatformReleaseHistoryCsv,
  createPlatformReleaseHistorySummary,
  createPlatformReleaseNotesDraft,
  createPlatformReleaseNotesMarkdown,
  createPlatformReleaseReadiness,
  createPlatformReleaseTriage,
  createPlatformReleaseWorkflow,
  filterPlatformFeedback
} from "./platform-inbox";

const feedback: FeedbackItemDraft[] = [
  {
    workspaceId: "workspace-1",
    sourceThreadId: "thread-1",
    sourceMessageId: "message-1",
    type: "feature_request",
    status: "new",
    priority: "normal",
    moduleContext: "leads",
    role: "admin",
    appVersion: "0.1.0"
  },
  {
    workspaceId: "workspace-1",
    sourceThreadId: "thread-2",
    sourceMessageId: "message-2",
    type: "bug_report",
    status: "new",
    priority: "normal",
    moduleContext: "clients",
    role: "manager",
    appVersion: "0.1.0"
  }
];

const actions: AssistantActionWriteDraft[] = [
  {
    workspaceId: "workspace-1",
    threadId: "thread-3",
    messageId: "message-3",
    actionType: "create_lead",
    preview: {
      actionType: "create_lead",
      summary: "Create lead from assistant request",
      changes: [],
      warnings: [],
      requiresConfirmation: true
    },
    status: "awaiting_confirmation",
    requestedByUserId: "user-1"
  }
];

describe("platform inbox summary", () => {
  it("counts feedback and action drafts", () => {
    expect(createPlatformInboxSummary({ feedback, actions })).toMatchObject({
      feedbackCount: 2,
      actionCount: 1,
      openCount: 3
    });
  });

  it("groups feedback by type", () => {
    expect(createPlatformInboxSummary({ feedback, actions }).feedbackByType).toEqual({
      bug_report: 1,
      feature_request: 1
    });
  });

  it("creates rows for feedback and action queues", () => {
    expect(createPlatformInboxSummary({ feedback, actions }).rows).toEqual([
      expect.objectContaining({
        id: "feedback-message-1",
        kind: "feedback",
        label: "feature_request",
        moduleContext: "leads",
        status: "new",
        appVersion: "0.1.0"
      }),
      expect.objectContaining({
        id: "feedback-message-2",
        kind: "feedback",
        label: "bug_report",
        moduleContext: "clients",
        status: "new"
      }),
      expect.objectContaining({
        id: "action-message-3",
        kind: "action",
        label: "create_lead",
        moduleContext: "assistant",
        status: "awaiting_confirmation"
      })
    ]);
  });

  it("filters feedback by status and type before creating the queue", () => {
    expect(
      filterPlatformFeedback(feedback, {
        status: "new",
        type: "bug_report",
        appVersion: "0.1.0"
      })
    ).toEqual([expect.objectContaining({ sourceMessageId: "message-2", type: "bug_report" })]);
  });

  it("filters feedback by app version", () => {
    expect(filterPlatformFeedback(feedback, { appVersion: "0.1.0" })).toHaveLength(2);
    expect(filterPlatformFeedback(feedback, { appVersion: "0.2.0" })).toEqual([]);
  });

  it("exports feedback rows as CSV", () => {
    expect(createPlatformFeedbackCsv([feedback[0]!])).toBe(
      [
        "sourceMessageId,type,status,moduleContext,role,appVersion",
        "message-1,feature_request,new,leads,admin,0.1.0"
      ].join("\n")
    );
  });

  it("creates a bulk update plan for selected feedback rows", () => {
    expect(createPlatformFeedbackBulkUpdatePlan(feedback, "archive")).toEqual({
      event: "archive",
      count: 2,
      items: [
        { workspaceId: "workspace-1", sourceMessageId: "message-1" },
        { workspaceId: "workspace-1", sourceMessageId: "message-2" }
      ]
    });
  });

  it("creates a release action plan for actionable feedback in one app version", () => {
    expect(
      createPlatformReleaseActionPlan(
        [
          ...feedback,
          {
            workspaceId: "workspace-1",
            sourceThreadId: "thread-4",
            sourceMessageId: "message-4",
            type: "feature_request",
            status: "planned",
            priority: "normal",
            moduleContext: "projects",
            role: "admin",
            appVersion: "0.1.0"
          },
          {
            workspaceId: "workspace-1",
            sourceThreadId: "thread-5",
            sourceMessageId: "message-5",
            type: "feature_request",
            status: "new",
            priority: "normal",
            moduleContext: "projects",
            role: "admin",
            appVersion: "0.2.0"
          }
        ],
        { appVersion: "0.1.0", event: "plan" }
      )
    ).toEqual({
      event: "plan",
      appVersion: "0.1.0",
      count: 2,
      skippedCount: 1,
      items: [
        { workspaceId: "workspace-1", sourceMessageId: "message-1" },
        { workspaceId: "workspace-1", sourceMessageId: "message-2" }
      ]
    });
  });

  it("creates a release workflow checklist for one app version", () => {
    expect(
      createPlatformReleaseWorkflow("0.1.0", [
        ...feedback,
        {
          workspaceId: "workspace-1",
          sourceThreadId: "thread-4",
          sourceMessageId: "message-4",
          type: "support_request",
          status: "planned",
          priority: "normal",
          moduleContext: "documents",
          role: "member",
          appVersion: "0.1.0"
        }
      ])
    ).toEqual({
      appVersion: "0.1.0",
      title: "v0.1.0 release workflow",
      totalCount: 3,
      actionableCount: 2,
      plannedCount: 1,
      steps: [
        { label: "Capture versioned feedback", status: "done", detail: "3 signals captured" },
        { label: "Plan actionable items", status: "active", detail: "2 signals still need planning" },
        { label: "Review release notes draft", status: "active", detail: "3 draft items ready" },
        { label: "Export Markdown notes", status: "ready", detail: "Draft can be downloaded" }
      ]
    });
  });

  it("summarizes release readiness for one app version", () => {
    expect(
      createPlatformReleaseReadiness("0.1.0", [
        { ...feedback[0]!, status: "planned" },
        { ...feedback[1]!, status: "planned" }
      ])
    ).toEqual({
      appVersion: "0.1.0",
      status: "ready",
      summary: "Ready for release note review",
      blockers: [],
      signals: {
        totalCount: 2,
        actionableCount: 0,
        plannedCount: 2,
        draftItemCount: 2
      }
    });

    expect(createPlatformReleaseReadiness("0.1.0", feedback)).toMatchObject({
      status: "blocked",
      summary: "2 feedback signals need planning",
      blockers: ["Plan actionable feedback before release review"]
    });
  });

  it("creates release planning history from audit events", () => {
    expect(
      createPlatformReleaseHistory([
        {
          workspaceId: "workspace-1",
          actorUserId: "user-1",
          action: "platform.release.planned",
          targetType: "PlatformRelease",
          targetId: "0.2.0",
          metadata: { appVersion: "0.2.0", plannedCount: 1, skippedCount: 0 }
        },
        {
          workspaceId: "workspace-1",
          actorUserId: "user-2",
          action: "assistant.message.submitted",
          targetType: "AssistantMessage",
          targetId: "message-1",
          metadata: {}
        },
        {
          workspaceId: "workspace-1",
          action: "platform.release.planned",
          targetType: "PlatformRelease",
          targetId: "0.1.0",
          metadata: { appVersion: "0.1.0", plannedCount: 3, skippedCount: 1 }
        }
      ])
    ).toEqual([
      {
        appVersion: "0.2.0",
        actorUserId: "user-1",
        plannedCount: 1,
        skippedCount: 0
      },
      {
        appVersion: "0.1.0",
        actorUserId: undefined,
        plannedCount: 3,
        skippedCount: 1
      }
    ]);
  });

  it("filters release planning history by app version", () => {
    expect(
      createPlatformReleaseHistory(
        [
          {
            workspaceId: "workspace-1",
            actorUserId: "user-1",
            action: "platform.release.planned",
            targetType: "PlatformRelease",
            targetId: "0.2.0",
            metadata: { appVersion: "0.2.0", plannedCount: 1, skippedCount: 0 }
          },
          {
            workspaceId: "workspace-1",
            actorUserId: "user-2",
            action: "platform.release.planned",
            targetType: "PlatformRelease",
            targetId: "0.1.0",
            metadata: { appVersion: "0.1.0", plannedCount: 2, skippedCount: 1 }
          }
        ],
        { appVersion: "0.1.0" }
      )
    ).toEqual([
      {
        appVersion: "0.1.0",
        actorUserId: "user-2",
        plannedCount: 2,
        skippedCount: 1
      }
    ]);
  });

  it("exports release planning history as CSV", () => {
    expect(
      createPlatformReleaseHistoryCsv([
        {
          appVersion: "0.2.0",
          actorUserId: "user-1",
          plannedCount: 1,
          skippedCount: 0
        },
        {
          appVersion: "0.1.0",
          actorUserId: undefined,
          plannedCount: 3,
          skippedCount: 1
        }
      ])
    ).toBe(
      [
        "appVersion,actorUserId,plannedCount,skippedCount",
        "0.2.0,user-1,1,0",
        "0.1.0,system,3,1"
      ].join("\n")
    );
  });

  it("summarizes release planning history totals", () => {
    expect(
      createPlatformReleaseHistorySummary([
        {
          appVersion: "0.2.0",
          actorUserId: "user-1",
          plannedCount: 1,
          skippedCount: 0
        },
        {
          appVersion: "0.1.0",
          actorUserId: undefined,
          plannedCount: 3,
          skippedCount: 1
        }
      ])
    ).toEqual({
      planningEventCount: 2,
      plannedCount: 4,
      skippedCount: 1,
      actorCounts: {
        "user-1": 1,
        system: 1
      }
    });
  });

  it("groups feedback into release triage summaries by app version", () => {
    const triage = createPlatformReleaseTriage([
      ...feedback,
      {
        workspaceId: "workspace-1",
        sourceThreadId: "thread-4",
        sourceMessageId: "message-4",
        type: "feature_request",
        status: "planned",
        priority: "normal",
        moduleContext: "projects",
        role: "admin",
        appVersion: "0.2.0"
      }
    ]);

    expect(triage).toEqual([
      {
        appVersion: "0.2.0",
        totalCount: 1,
        openCount: 1,
        byType: { feature_request: 1 },
        byStatus: { planned: 1 }
      },
      {
        appVersion: "0.1.0",
        totalCount: 2,
        openCount: 2,
        byType: { bug_report: 1, feature_request: 1 },
        byStatus: { new: 2 }
      }
    ]);
  });

  it("creates release notes draft sections from versioned feedback", () => {
    const notes = createPlatformReleaseNotesDraft("0.1.0", [
      ...feedback,
      {
        workspaceId: "workspace-1",
        sourceThreadId: "thread-5",
        sourceMessageId: "message-5",
        type: "support_request",
        status: "triaged",
        priority: "normal",
        moduleContext: "documents",
        role: "member",
        appVersion: "0.1.0"
      },
      {
        workspaceId: "workspace-1",
        sourceThreadId: "thread-6",
        sourceMessageId: "message-6",
        type: "feature_request",
        status: "new",
        priority: "normal",
        moduleContext: "projects",
        role: "admin",
        appVersion: "0.2.0"
      }
    ]);

    expect(notes).toEqual({
      appVersion: "0.1.0",
      title: "v0.1.0 release notes draft",
      sections: [
        {
          title: "Features",
          items: [{ label: "leads feature request", sourceMessageId: "message-1", status: "new" }]
        },
        {
          title: "Fixes",
          items: [{ label: "clients bug report", sourceMessageId: "message-2", status: "new" }]
        },
        {
          title: "Support and UX",
          items: [{ label: "documents support request", sourceMessageId: "message-5", status: "triaged" }]
        }
      ]
    });
  });

  it("renders release notes draft as Markdown", () => {
    expect(
      createPlatformReleaseNotesMarkdown({
        appVersion: "0.1.0",
        title: "v0.1.0 release notes draft",
        sections: [
          {
            title: "Features",
            items: [{ label: "leads feature request", sourceMessageId: "message-1", status: "planned" }]
          },
          {
            title: "Fixes",
            items: []
          },
          {
            title: "Support and UX",
            items: [{ label: "documents support request", sourceMessageId: "message-5", status: "triaged" }]
          }
        ]
      })
    ).toBe(
      [
        "# v0.1.0 release notes draft",
        "",
        "## Features",
        "- leads feature request (planned, message-1)",
        "",
        "## Fixes",
        "- No items",
        "",
        "## Support and UX",
        "- documents support request (triaged, message-5)"
      ].join("\n")
    );
  });
});
