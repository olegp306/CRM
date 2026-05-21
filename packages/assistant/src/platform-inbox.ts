import type { FeedbackItemDraft, FeedbackItemIntent, FeedbackItemStatus } from "./feedback-item";
import { canTransitionFeedbackStatus, type FeedbackTriageEvent } from "./feedback-triage";
import type { AssistantActionWriteDraft } from "./persistence";

export type PlatformFeedbackFilters = {
  status?: FeedbackItemStatus;
  type?: FeedbackItemIntent;
  appVersion?: string;
};

export type PlatformInboxRow = {
  id: string;
  kind: "feedback" | "action";
  label: string;
  moduleContext: string;
  status: string;
  sourceThreadId: string;
  sourceMessageId: string;
  appVersion: string;
};

export type PlatformInboxSummary = {
  feedbackCount: number;
  actionCount: number;
  openCount: number;
  feedbackByType: Record<string, number>;
  rows: PlatformInboxRow[];
};

export type PlatformReleaseTriageRow = {
  appVersion: string;
  totalCount: number;
  openCount: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
};

export type PlatformReleaseNotesItem = {
  label: string;
  sourceMessageId: string;
  status: FeedbackItemStatus;
};

export type PlatformReleaseNotesSection = {
  title: "Features" | "Fixes" | "Support and UX";
  items: PlatformReleaseNotesItem[];
};

export type PlatformReleaseNotesDraft = {
  appVersion: string;
  title: string;
  sections: PlatformReleaseNotesSection[];
};

export type PlatformFeedbackBulkUpdatePlan = {
  event: FeedbackTriageEvent;
  count: number;
  items: Array<{
    workspaceId: string;
    sourceMessageId: string;
  }>;
};

export type PlatformReleaseActionPlan = PlatformFeedbackBulkUpdatePlan & {
  appVersion: string;
  skippedCount: number;
};

export type PlatformReleaseWorkflowStep = {
  label: string;
  status: "todo" | "active" | "ready" | "done";
  detail: string;
};

export type PlatformReleaseWorkflow = {
  appVersion: string;
  title: string;
  totalCount: number;
  actionableCount: number;
  plannedCount: number;
  steps: PlatformReleaseWorkflowStep[];
};

export function createPlatformInboxSummary({
  feedback,
  actions
}: {
  feedback: FeedbackItemDraft[];
  actions: AssistantActionWriteDraft[];
}): PlatformInboxSummary {
  const feedbackByType = feedback.reduce<Record<string, number>>((counts, item) => {
    counts[item.type] = (counts[item.type] ?? 0) + 1;
    return counts;
  }, {});

  return {
    feedbackCount: feedback.length,
    actionCount: actions.length,
    openCount: feedback.length + actions.length,
    feedbackByType,
    rows: [
      ...feedback.map((item) => ({
        id: `feedback-${item.sourceMessageId}`,
        kind: "feedback" as const,
        label: item.type,
        moduleContext: item.moduleContext ?? "other",
        status: item.status,
        sourceThreadId: item.sourceThreadId,
        sourceMessageId: item.sourceMessageId,
        appVersion: item.appVersion
      })),
      ...actions.map((action) => ({
        id: `action-${action.messageId}`,
        kind: "action" as const,
        label: action.actionType,
        moduleContext: "assistant",
        status: action.status,
        sourceThreadId: action.threadId,
        sourceMessageId: action.messageId,
        appVersion: "unknown"
      }))
    ]
  };
}

export function filterPlatformFeedback(
  feedback: FeedbackItemDraft[],
  filters: PlatformFeedbackFilters
): FeedbackItemDraft[] {
  return feedback.filter((item) => {
    if (filters.status && item.status !== filters.status) {
      return false;
    }

    if (filters.type && item.type !== filters.type) {
      return false;
    }

    if (filters.appVersion && item.appVersion !== filters.appVersion) {
      return false;
    }

    return true;
  });
}

export function createPlatformFeedbackCsv(feedback: FeedbackItemDraft[]): string {
  return [
    "sourceMessageId,type,status,moduleContext,role,appVersion",
    ...feedback.map((item) =>
      [item.sourceMessageId, item.type, item.status, item.moduleContext ?? "", item.role ?? "", item.appVersion]
        .map(escapeCsvCell)
        .join(",")
    )
  ].join("\n");
}

function escapeCsvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll("\"", "\"\"")}"` : value;
}

export function createPlatformFeedbackBulkUpdatePlan(
  feedback: FeedbackItemDraft[],
  event: FeedbackTriageEvent
): PlatformFeedbackBulkUpdatePlan {
  return {
    event,
    count: feedback.length,
    items: feedback.map((item) => ({
      workspaceId: item.workspaceId,
      sourceMessageId: item.sourceMessageId
    }))
  };
}

export function createPlatformReleaseActionPlan(
  feedback: FeedbackItemDraft[],
  {
    appVersion,
    event
  }: {
    appVersion: string;
    event: FeedbackTriageEvent;
  }
): PlatformReleaseActionPlan {
  const versionFeedback = feedback.filter((item) => item.appVersion === appVersion);
  const actionableFeedback = versionFeedback.filter((item) => canTransitionFeedbackStatus(item.status, event));
  const plan = createPlatformFeedbackBulkUpdatePlan(actionableFeedback, event);

  return {
    ...plan,
    appVersion,
    skippedCount: versionFeedback.length - actionableFeedback.length
  };
}

export function createPlatformReleaseWorkflow(appVersion: string, feedback: FeedbackItemDraft[]): PlatformReleaseWorkflow {
  const versionFeedback = feedback.filter((item) => item.appVersion === appVersion);
  const actionPlan = createPlatformReleaseActionPlan(feedback, { appVersion, event: "plan" });
  const draft = createPlatformReleaseNotesDraft(appVersion, feedback);
  const draftItemCount = draft.sections.reduce((count, section) => count + section.items.length, 0);
  const plannedCount = versionFeedback.filter((item) => item.status === "planned").length;

  return {
    appVersion,
    title: `v${appVersion} release workflow`,
    totalCount: versionFeedback.length,
    actionableCount: actionPlan.count,
    plannedCount,
    steps: [
      {
        label: "Capture versioned feedback",
        status: versionFeedback.length > 0 ? "done" : "todo",
        detail: `${versionFeedback.length} signals captured`
      },
      {
        label: "Plan actionable items",
        status: actionPlan.count > 0 ? "active" : "done",
        detail: actionPlan.count > 0 ? `${actionPlan.count} signals still need planning` : "All actionable signals planned"
      },
      {
        label: "Review release notes draft",
        status: draftItemCount > 0 ? "active" : "todo",
        detail: `${draftItemCount} draft items ready`
      },
      {
        label: "Export Markdown notes",
        status: draftItemCount > 0 ? "ready" : "todo",
        detail: draftItemCount > 0 ? "Draft can be downloaded" : "Draft needs feedback first"
      }
    ]
  };
}

export function createPlatformReleaseTriage(feedback: FeedbackItemDraft[]): PlatformReleaseTriageRow[] {
  const rowsByVersion = new Map<string, PlatformReleaseTriageRow>();

  for (const item of feedback) {
    const appVersion = item.appVersion || "unknown";
    const row =
      rowsByVersion.get(appVersion) ??
      {
        appVersion,
        totalCount: 0,
        openCount: 0,
        byType: {},
        byStatus: {}
      };

    row.totalCount += 1;
    if (item.status === "new" || item.status === "triaged" || item.status === "planned") {
      row.openCount += 1;
    }
    row.byType[item.type] = (row.byType[item.type] ?? 0) + 1;
    row.byStatus[item.status] = (row.byStatus[item.status] ?? 0) + 1;
    rowsByVersion.set(appVersion, row);
  }

  return Array.from(rowsByVersion.values()).sort((left, right) => compareVersionsDesc(left.appVersion, right.appVersion));
}

export function createPlatformReleaseNotesDraft(
  appVersion: string,
  feedback: FeedbackItemDraft[]
): PlatformReleaseNotesDraft {
  const versionFeedback = feedback.filter((item) => item.appVersion === appVersion);
  const sections: PlatformReleaseNotesSection[] = [
    {
      title: "Features",
      items: versionFeedback.filter((item) => item.type === "feature_request").map(toReleaseNotesItem)
    },
    {
      title: "Fixes",
      items: versionFeedback.filter((item) => item.type === "bug_report").map(toReleaseNotesItem)
    },
    {
      title: "Support and UX",
      items: versionFeedback
        .filter((item) => item.type === "support_request" || item.type === "ux_feedback" || item.type === "permission_blocked")
        .map(toReleaseNotesItem)
    }
  ];

  return {
    appVersion,
    title: `v${appVersion} release notes draft`,
    sections
  };
}

export function createPlatformReleaseNotesMarkdown(draft: PlatformReleaseNotesDraft): string {
  return [
    `# ${draft.title}`,
    "",
    ...draft.sections.flatMap((section, index) => [
      `## ${section.title}`,
      ...(section.items.length > 0
        ? section.items.map((item) => `- ${item.label} (${item.status}, ${item.sourceMessageId})`)
        : ["- No items"]),
      ...(index === draft.sections.length - 1 ? [] : [""])
    ])
  ].join("\n");
}

function toReleaseNotesItem(item: FeedbackItemDraft): PlatformReleaseNotesItem {
  return {
    label: `${item.moduleContext ?? "other"} ${item.type.replace("_", " ")}`,
    sourceMessageId: item.sourceMessageId,
    status: item.status
  };
}

function compareVersionsDesc(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  if (left === "unknown") {
    return 1;
  }

  if (right === "unknown") {
    return -1;
  }

  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);

  for (let index = 0; index < 3; index += 1) {
    const diff = (rightParts[index] ?? 0) - (leftParts[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return left.localeCompare(right);
}
