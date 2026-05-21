import { describe, expect, it } from "vitest";
import {
  attachProjectFile,
  createDecision,
  createOperationalProjectWorkspace,
  supersedeDecision,
  updateChecklistItem,
  updateProjectTask
} from "./project-operations";

describe("L03 project operations domain", () => {
  it("creates an operational project workspace from the default phase template", () => {
    const workspace = createOperationalProjectWorkspace({
      workspaceId: "workspace-1",
      projectId: "P-2026-001",
      projectName: "Beispielstrasse New Build",
      clientRecordId: "client-record-1",
      leadRecordId: "lead-record-1",
      externalLinks: {
        googleDriveUrl: "https://drive.example/project",
        telegramUrl: "https://t.me/project",
        hubstaffUrl: "https://hubstaff.example/project",
        whatsappUrl: "https://wa.me/4930123",
        miroUrl: "https://miro.example/board",
        archicadPath: "BIM/Beispielstrasse.pln"
      }
    });

    expect(workspace.project).toMatchObject({
      workspaceId: "workspace-1",
      projectId: "P-2026-001",
      projectName: "Beispielstrasse New Build",
      clientRecordId: "client-record-1",
      leadRecordId: "lead-record-1",
      status: "active",
      currentPhase: "Negotiations"
    });
    expect(workspace.phases).toHaveLength(12);
    expect(workspace.phases.map((phase) => phase.name)).toEqual([
      "Negotiations",
      "Ecosystem",
      "Client/project discovery",
      "Analysis",
      "File preparation",
      "First sketch",
      "Revisions",
      "LP3",
      "LP4",
      "Submission",
      "Bauamt feedback",
      "Completed/archive"
    ]);
    expect(workspace.tasks[0]).toMatchObject({
      title: "Confirm contract and deposit",
      status: "todo",
      priority: "normal",
      phaseId: workspace.phases[0]?.id
    });
    expect(workspace.checklistItems.filter((item) => item.taskId === workspace.tasks[0]?.id)).toEqual([
      expect.objectContaining({ label: "Contract signed", isDone: false }),
      expect.objectContaining({ label: "Deposit received", isDone: false })
    ]);
    expect(workspace.externalLinks).toMatchObject({
      googleDriveUrl: "https://drive.example/project",
      archicadPath: "BIM/Beispielstrasse.pln"
    });
  });

  it("updates task cards and checklist items without losing CRM identity", () => {
    const workspace = createOperationalProjectWorkspace({
      workspaceId: "workspace-1",
      projectId: "P-2026-001",
      projectName: "Beispielstrasse New Build"
    });

    const task = updateProjectTask(workspace.tasks[0]!, {
      status: "in_progress",
      assigneeUserId: "user-main",
      dueDate: new Date("2026-05-28T00:00:00.000Z"),
      priority: "high",
      blockedByTaskId: "task-blocker-1",
      activity: "Owner confirmed contract call."
    });
    const checklistItem = updateChecklistItem(workspace.checklistItems[0]!, true);

    expect(task).toMatchObject({
      projectId: "P-2026-001",
      status: "in_progress",
      assigneeUserId: "user-main",
      dueDate: new Date("2026-05-28T00:00:00.000Z"),
      priority: "high",
      blockedByTaskId: "task-blocker-1",
      activity: ["Owner confirmed contract call."]
    });
    expect(checklistItem).toMatchObject({ isDone: true });
    expect(workspace.project.projectId).toBe("P-2026-001");
  });

  it("records and supersedes decisions as a first-class decision log", () => {
    const decision = createDecision({
      projectId: "P-2026-001",
      title: "Facade material",
      decisionText: "Use brick facade for planning variant A.",
      source: "client_call",
      decidedByUserId: "user-main",
      relatedPhase: "LP3",
      decidedAt: new Date("2026-05-21T00:00:00.000Z")
    });
    const superseding = supersedeDecision(decision, {
      title: "Facade material update",
      decisionText: "Use plaster facade due budget constraints.",
      source: "revision_meeting",
      decidedByUserId: "user-main",
      decidedAt: new Date("2026-06-01T00:00:00.000Z")
    });

    expect(decision).toMatchObject({
      status: "approved",
      source: "client_call",
      relatedPhase: "LP3"
    });
    expect(superseding.previousDecision).toMatchObject({ status: "superseded" });
    expect(superseding.nextDecision).toMatchObject({
      supersedesDecisionId: decision.id,
      status: "approved",
      decisionText: "Use plaster facade due budget constraints."
    });
  });

  it("attaches files to project, task, and decision while keeping generated documents historical", () => {
    const projectFile = attachProjectFile({
      workspaceId: "workspace-1",
      targetType: "project",
      targetId: "P-2026-001",
      fileName: "LP3 Plan.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048,
      createdByUserId: "user-main"
    });
    const taskFile = attachProjectFile({
      workspaceId: "workspace-1",
      targetType: "task",
      targetId: "task-1",
      fileName: "Checklist evidence.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024
    });
    const oldGeneratedDoc = attachProjectFile({
      workspaceId: "workspace-1",
      targetType: "decision",
      targetId: "decision-1",
      fileName: "KP old.pdf",
      mimeType: "application/pdf",
      sizeBytes: 4096,
      source: "generated_document",
      status: "obsolete"
    });

    expect(projectFile).toMatchObject({ targetType: "project", status: "current", lifecycle: "project_file" });
    expect(taskFile).toMatchObject({ targetType: "task", status: "current", lifecycle: "project_file" });
    expect(oldGeneratedDoc).toMatchObject({
      targetType: "decision",
      source: "generated_document",
      status: "obsolete",
      lifecycle: "historical_attachment"
    });
  });
});
