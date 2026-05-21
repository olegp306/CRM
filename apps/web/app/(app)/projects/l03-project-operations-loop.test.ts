import { describe, expect, it } from "vitest";
import {
  attachProjectFile,
  createDecision,
  createOperationalProjectWorkspace,
  supersedeDecision,
  updateChecklistItem,
  updateProjectTask
} from "@app/core";

describe("L03 project operations loop", () => {
  it("creates an operational project workspace with tasks, decisions, files, and CRM identity", () => {
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
      projectId: "P-2026-001",
      clientRecordId: "client-record-1",
      leadRecordId: "lead-record-1",
      status: "active",
      currentPhase: "Negotiations"
    });
    expect(workspace.phases).toHaveLength(12);
    expect(workspace.tasks.length).toBeGreaterThanOrEqual(12);

    const activeTask = updateProjectTask(workspace.tasks[0]!, {
      status: "in_progress",
      assigneeUserId: "user-main",
      dueDate: new Date("2026-05-28T00:00:00.000Z"),
      priority: "high",
      blockedByTaskId: "task-blocker-1",
      activity: "Contract reviewed with client."
    });
    const doneChecklistItem = updateChecklistItem(workspace.checklistItems[0]!, true);

    expect(activeTask).toMatchObject({
      projectId: "P-2026-001",
      status: "in_progress",
      assigneeUserId: "user-main",
      priority: "high",
      blockedByTaskId: "task-blocker-1",
      activity: ["Contract reviewed with client."]
    });
    expect(doneChecklistItem).toMatchObject({ isDone: true });

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

    expect(superseding.previousDecision.status).toBe("superseded");
    expect(superseding.nextDecision).toMatchObject({
      supersedesDecisionId: decision.id,
      status: "approved"
    });

    const projectFile = attachProjectFile({
      workspaceId: "workspace-1",
      targetType: "project",
      targetId: "P-2026-001",
      fileName: "LP3 Plan.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048
    });
    const taskFile = attachProjectFile({
      workspaceId: "workspace-1",
      targetType: "task",
      targetId: activeTask.id,
      fileName: "Checklist evidence.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024
    });
    const oldGeneratedDocument = attachProjectFile({
      workspaceId: "workspace-1",
      targetType: "decision",
      targetId: decision.id,
      fileName: "KP old.pdf",
      mimeType: "application/pdf",
      sizeBytes: 4096,
      source: "generated_document",
      status: "obsolete"
    });

    expect(projectFile).toMatchObject({ targetType: "project", lifecycle: "project_file" });
    expect(taskFile).toMatchObject({ targetType: "task", lifecycle: "project_file" });
    expect(oldGeneratedDocument).toMatchObject({ lifecycle: "historical_attachment", status: "obsolete" });
    expect(workspace.externalLinks).toMatchObject({
      googleDriveUrl: "https://drive.example/project",
      archicadPath: "BIM/Beispielstrasse.pln"
    });
  });
});
