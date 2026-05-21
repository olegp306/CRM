import { createDefaultProjectTemplate } from "./project-template";

export type ProjectTaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type ProjectTaskPriority = "low" | "normal" | "high" | "urgent";
export type ProjectAttachmentStatus = "draft" | "current" | "obsolete" | "archived";
export type ProjectAttachmentTargetType = "project" | "task" | "decision";

export type ProjectExternalLinks = {
  googleDriveUrl?: string;
  telegramUrl?: string;
  hubstaffUrl?: string;
  whatsappUrl?: string;
  miroUrl?: string;
  archicadPath?: string;
};

export type OperationalProject = {
  workspaceId: string;
  projectId: string;
  projectName: string;
  clientRecordId?: string;
  leadRecordId?: string;
  status: "active";
  currentPhase: string;
};

export type OperationalProjectPhase = {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
  status: "not_started" | "active" | "done";
};

export type OperationalProjectTask = {
  id: string;
  projectId: string;
  phaseId: string;
  title: string;
  status: ProjectTaskStatus;
  assigneeUserId?: string;
  dueDate?: Date;
  priority: ProjectTaskPriority;
  blockedByTaskId?: string;
  activity: string[];
};

export type OperationalChecklistItem = {
  id: string;
  taskId: string;
  label: string;
  isDone: boolean;
  sortOrder: number;
};

export type ProjectDecision = {
  id: string;
  projectId: string;
  title: string;
  decisionText: string;
  status: "approved" | "superseded";
  source: string;
  decidedByUserId?: string;
  decisionDate: Date;
  relatedPhase?: string;
  relatedTaskId?: string;
  supersedesDecisionId?: string;
};

export type ProjectAttachment = {
  id: string;
  workspaceId: string;
  targetType: ProjectAttachmentTargetType;
  targetId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: ProjectAttachmentStatus;
  source: "upload" | "generated_document";
  lifecycle: "project_file" | "historical_attachment";
  createdByUserId?: string;
};

export function createOperationalProjectWorkspace({
  workspaceId,
  projectId,
  projectName,
  clientRecordId,
  leadRecordId,
  externalLinks = {}
}: {
  workspaceId: string;
  projectId: string;
  projectName: string;
  clientRecordId?: string;
  leadRecordId?: string;
  externalLinks?: ProjectExternalLinks;
}) {
  const template = createDefaultProjectTemplate();
  const phases: OperationalProjectPhase[] = template.phases.map((phase, phaseIndex) => ({
    id: `${projectId}-phase-${phaseIndex + 1}`,
    projectId,
    name: phase.name,
    sortOrder: phaseIndex + 1,
    status: phaseIndex === 0 ? "active" : "not_started"
  }));
  const tasks: OperationalProjectTask[] = [];
  const checklistItems: OperationalChecklistItem[] = [];

  template.phases.forEach((phase, phaseIndex) => {
    phase.tasks.forEach((task, taskIndex) => {
      const taskId = `${projectId}-task-${phaseIndex + 1}-${taskIndex + 1}`;
      tasks.push({
        id: taskId,
        projectId,
        phaseId: phases[phaseIndex]!.id,
        title: task.title,
        status: "todo",
        priority: "normal",
        activity: []
      });

      task.checklist.forEach((label, checklistIndex) => {
        checklistItems.push({
          id: `${taskId}-checklist-${checklistIndex + 1}`,
          taskId,
          label,
          isDone: false,
          sortOrder: checklistIndex + 1
        });
      });
    });
  });

  return {
    project: {
      workspaceId,
      projectId,
      projectName,
      clientRecordId,
      leadRecordId,
      status: "active",
      currentPhase: phases[0]?.name ?? ""
    } satisfies OperationalProject,
    phases,
    tasks,
    checklistItems,
    decisions: [] as ProjectDecision[],
    attachments: [] as ProjectAttachment[],
    externalLinks
  };
}

export function updateProjectTask(
  task: OperationalProjectTask,
  update: Partial<Omit<OperationalProjectTask, "id" | "projectId" | "phaseId" | "title" | "activity">> & {
    activity?: string;
  }
): OperationalProjectTask {
  return {
    ...task,
    ...update,
    activity: update.activity ? [...task.activity, update.activity] : task.activity
  };
}

export function updateChecklistItem(item: OperationalChecklistItem, isDone: boolean): OperationalChecklistItem {
  return { ...item, isDone };
}

export function createDecision({
  projectId,
  title,
  decisionText,
  source,
  decidedByUserId,
  relatedPhase,
  relatedTaskId,
  decidedAt = new Date(),
  supersedesDecisionId
}: {
  projectId: string;
  title: string;
  decisionText: string;
  source: string;
  decidedByUserId?: string;
  relatedPhase?: string;
  relatedTaskId?: string;
  decidedAt?: Date;
  supersedesDecisionId?: string;
}): ProjectDecision {
  return {
    id: `${projectId}-decision-${decidedAt.getTime()}`,
    projectId,
    title,
    decisionText,
    status: "approved",
    source,
    decidedByUserId,
    decisionDate: decidedAt,
    relatedPhase,
    relatedTaskId,
    supersedesDecisionId
  };
}

export function supersedeDecision(
  previousDecision: ProjectDecision,
  nextDecisionInput: Omit<Parameters<typeof createDecision>[0], "projectId" | "supersedesDecisionId">
): { previousDecision: ProjectDecision; nextDecision: ProjectDecision } {
  return {
    previousDecision: { ...previousDecision, status: "superseded" },
    nextDecision: createDecision({
      ...nextDecisionInput,
      projectId: previousDecision.projectId,
      supersedesDecisionId: previousDecision.id
    })
  };
}

export function attachProjectFile({
  workspaceId,
  targetType,
  targetId,
  fileName,
  mimeType,
  sizeBytes,
  status = "current",
  source = "upload",
  createdByUserId
}: {
  workspaceId: string;
  targetType: ProjectAttachmentTargetType;
  targetId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status?: ProjectAttachmentStatus;
  source?: ProjectAttachment["source"];
  createdByUserId?: string;
}): ProjectAttachment {
  return {
    id: `${targetType}-${targetId}-attachment-${normalizeFileName(fileName)}`,
    workspaceId,
    targetType,
    targetId,
    fileName,
    mimeType,
    sizeBytes,
    status,
    source,
    lifecycle: source === "generated_document" || status === "obsolete" ? "historical_attachment" : "project_file",
    createdByUserId
  };
}

function normalizeFileName(fileName: string): string {
  return fileName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
