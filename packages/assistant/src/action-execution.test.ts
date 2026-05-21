import { describe, expect, it } from "vitest";
import type { AssistantActionWriteDraft } from "./persistence";
import { executeAssistantAction } from "./action-execution";

const action: AssistantActionWriteDraft = {
  workspaceId: "workspace-1",
  threadId: "thread-1",
  messageId: "message-1",
  actionType: "create_lead",
  preview: {
    actionType: "create_lead",
    summary: "Create lead from assistant request",
    changes: [{ field: "lead.sourceText", from: null, to: "Create lead Anna Beispiel" }],
    warnings: [],
    requiresConfirmation: true
  },
  status: "awaiting_confirmation",
  requestedByUserId: "user-1"
};

const followupAction: AssistantActionWriteDraft = {
  workspaceId: "workspace-1",
  threadId: "thread-1",
  messageId: "message-2",
  actionType: "schedule_followup",
  preview: {
    actionType: "schedule_followup",
    summary: "Schedule follow-up from assistant request",
    changes: [{ field: "followup.sourceText", from: null, to: "Schedule follow-up for lead L-2026-001 tomorrow" }],
    warnings: [],
    requiresConfirmation: true
  },
  status: "awaiting_confirmation",
  requestedByUserId: "user-1"
};

const projectTaskAction: AssistantActionWriteDraft = {
  workspaceId: "workspace-1",
  threadId: "thread-1",
  messageId: "message-3",
  actionType: "update_project_task",
  preview: {
    actionType: "update_project_task",
    summary: "Update project task from assistant request",
    changes: [
      { field: "project.selectedRecordIds", from: null, to: ["P-2026-001"] },
      { field: "task.sourceText", from: null, to: "Update project task permit package to done" }
    ],
    warnings: [],
    requiresConfirmation: true
  },
  status: "awaiting_confirmation",
  requestedByUserId: "user-1"
};

const generateKpAction: AssistantActionWriteDraft = {
  workspaceId: "workspace-1",
  threadId: "thread-1",
  messageId: "message-4",
  actionType: "generate_kp",
  preview: {
    actionType: "generate_kp",
    summary: "Generate KP document from assistant request",
    changes: [
      { field: "document.type", from: null, to: "kp" },
      { field: "document.selectedRecordIds", from: null, to: ["L-2026-001"] },
      { field: "document.sourceText", from: null, to: "Generate KP for lead L-2026-001" }
    ],
    warnings: [],
    requiresConfirmation: true
  },
  status: "awaiting_confirmation",
  requestedByUserId: "user-1"
};

const markKpSentAction: AssistantActionWriteDraft = {
  workspaceId: "workspace-1",
  threadId: "thread-1",
  messageId: "message-5",
  actionType: "mark_kp_sent",
  preview: {
    actionType: "mark_kp_sent",
    summary: "Mark KP as sent from assistant request",
    changes: [
      { field: "lead.selectedRecordIds", from: null, to: ["L-2026-001"] },
      { field: "lead.sourceText", from: null, to: "Mark KP sent for lead L-2026-001" }
    ],
    warnings: [],
    requiresConfirmation: true
  },
  status: "awaiting_confirmation",
  requestedByUserId: "user-1"
};

describe("executeAssistantAction", () => {
  it("confirms awaiting create lead actions and creates a lead from the preview", async () => {
    const createdLeads: unknown[] = [];

    const result = await executeAssistantAction({
      action,
      now: new Date("2026-05-21T00:00:00Z"),
      existingLeadIds: ["L-2026-001"],
      createLead: async (lead) => {
        createdLeads.push(lead);
        return { id: "lead-record-1", ...lead };
      }
    });

    expect(result).toEqual({
      status: "executed",
      leadId: "L-2026-002",
      recordId: "lead-record-1"
    });
    expect(createdLeads).toEqual([
      {
        workspaceId: "workspace-1",
        leadId: "L-2026-002",
        status: "new",
        rawInput: "Create lead Anna Beispiel"
      }
    ]);
  });

  it("rejects execution when the action has not been awaiting confirmation", async () => {
    await expect(
      executeAssistantAction({
        action: { ...action, status: "draft" },
        now: new Date("2026-05-21T00:00:00Z"),
        existingLeadIds: [],
        createLead: async (lead) => ({ id: "lead-record-1", ...lead })
      })
    ).rejects.toThrow("Cannot confirm action from draft");
  });

  it("confirms awaiting schedule follow-up actions through the follow-up port", async () => {
    const createdFollowups: unknown[] = [];

    const result = await executeAssistantAction({
      action: followupAction,
      now: new Date("2026-05-21T00:00:00Z"),
      existingLeadIds: [],
      createLead: async (lead) => ({ id: "lead-record-1", ...lead }),
      scheduleFollowup: async (followup) => {
        createdFollowups.push(followup);
        return { id: "followup-record-1", ...followup };
      }
    });

    expect(result).toEqual({
      status: "executed",
      actionType: "schedule_followup",
      followupId: "F-20260521-message-2",
      recordId: "followup-record-1"
    });
    expect(createdFollowups).toEqual([
      {
        workspaceId: "workspace-1",
        followupId: "F-20260521-message-2",
        rawInput: "Schedule follow-up for lead L-2026-001 tomorrow",
        requestedByUserId: "user-1"
      }
    ]);
  });

  it("confirms awaiting project task update actions through the task update port", async () => {
    const updatedTasks: unknown[] = [];

    const result = await executeAssistantAction({
      action: projectTaskAction,
      now: new Date("2026-05-21T00:00:00Z"),
      existingLeadIds: [],
      createLead: async (lead) => ({ id: "lead-record-1", ...lead }),
      updateProjectTask: async (taskUpdate) => {
        updatedTasks.push(taskUpdate);
        return { id: "task-update-record-1", ...taskUpdate };
      }
    });

    expect(result).toEqual({
      status: "executed",
      actionType: "update_project_task",
      taskUpdateId: "T-20260521-message-3",
      recordId: "task-update-record-1"
    });
    expect(updatedTasks).toEqual([
      {
        workspaceId: "workspace-1",
        taskUpdateId: "T-20260521-message-3",
        projectIds: ["P-2026-001"],
        rawInput: "Update project task permit package to done",
        requestedByUserId: "user-1"
      }
    ]);
  });

  it("confirms awaiting KP generation actions through the document generation port", async () => {
    const generatedDocuments: unknown[] = [];

    const result = await executeAssistantAction({
      action: generateKpAction,
      now: new Date("2026-05-21T00:00:00Z"),
      existingLeadIds: [],
      createLead: async (lead) => ({ id: "lead-record-1", ...lead }),
      generateKpDocument: async (document) => {
        generatedDocuments.push(document);
        return { id: "generated-document-record-1", ...document };
      }
    });

    expect(result).toEqual({
      status: "executed",
      actionType: "generate_kp",
      documentId: "D-20260521-message-4",
      recordId: "generated-document-record-1"
    });
    expect(generatedDocuments).toEqual([
      {
        workspaceId: "workspace-1",
        documentId: "D-20260521-message-4",
        documentType: "kp",
        sourceRecordIds: ["L-2026-001"],
        rawInput: "Generate KP for lead L-2026-001",
        requestedByUserId: "user-1"
      }
    ]);
  });

  it("confirms awaiting KP sent actions through the lead status port", async () => {
    const markedLeads: unknown[] = [];

    const result = await executeAssistantAction({
      action: markKpSentAction,
      now: new Date("2026-05-21T10:30:00.000Z"),
      existingLeadIds: [],
      createLead: async (lead) => ({ id: "lead-record-1", ...lead }),
      markKpSent: async (update) => {
        markedLeads.push(update);
        return { id: "lead-record-1", ...update };
      }
    });

    expect(result).toEqual({
      status: "executed",
      actionType: "mark_kp_sent",
      leadId: "L-2026-001",
      recordId: "lead-record-1"
    });
    expect(markedLeads).toEqual([
      {
        workspaceId: "workspace-1",
        leadId: "L-2026-001",
        status: "kp_sent",
        kpSentDate: new Date("2026-05-21T10:30:00.000Z"),
        followup1Date: new Date("2026-05-28T10:30:00.000Z"),
        followupStatus: "planned",
        requestedByUserId: "user-1"
      }
    ]);
  });
});
