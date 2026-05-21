import { describe, expect, it } from "vitest";
import { executeAssistantAction, type AssistantActionType, type AssistantActionWriteDraft } from "@app/assistant";
import {
  classifyLeadStandardness,
  detectLeadMissingData,
  findMatchingClient,
  validateClientInput
} from "@app/core";
import { createMemoryGeneratedDocumentStore } from "../assistant/document-execution-store";
import { createTodayFollowupViewModel } from "../today/today-store";

describe("L01 lead intake loop", () => {
  it("turns raw inbound lead text into lead, KP document attachments, and a due follow-up", async () => {
    const rawInput =
      "Anna Beispiel, anna@example.com, +49 30 123, new build, Beispielstrasse 1 Berlin, BGF 150 m2. Generate KP and follow up today.";
    const existingClients = [{ id: "client-1", name: "Anna Beispiel", email: "anna@example.com", phone: "+49 30 123" }];
    const clientInput = {
      name: "Anna Beispiel",
      clientType: "private",
      email: "anna@example.com",
      phone: "+49 30 123"
    };
    const leadInput = {
      clientName: "Anna Beispiel",
      requestType: "new_build",
      projectAddress: "Beispielstrasse 1 Berlin",
      bgfM2: 150
    };

    expect(validateClientInput(clientInput).ok).toBe(true);
    expect(findMatchingClient(existingClients, clientInput)).toEqual({ match: existingClients[0], reason: "email" });
    expect(detectLeadMissingData(leadInput)).toEqual([]);
    expect(classifyLeadStandardness(leadInput)).toEqual({ isStandard: true, reason: "standard_price_table_match" });

    const createdLeads: unknown[] = [];
    const createLeadAction = createAction("create_lead", "message-1", [
      { field: "lead.sourceText", from: null, to: rawInput }
    ]);
    const createdLead = await executeAssistantAction({
      action: createLeadAction,
      now: new Date("2026-05-21T00:00:00.000Z"),
      existingLeadIds: [],
      createLead: async (lead) => {
        createdLeads.push(lead);
        return { id: "lead-record-1", ...lead };
      }
    });

    expect(createdLead).toEqual({ status: "executed", leadId: "L-2026-001", recordId: "lead-record-1" });
    expect(createdLeads).toEqual([{ workspaceId: "workspace-1", leadId: "L-2026-001", status: "new", rawInput }]);

    const documentStore = createMemoryGeneratedDocumentStore([]);
    const generateKpAction = createAction("generate_kp", "message-2", [
      { field: "document.type", from: null, to: "kp" },
      { field: "document.selectedRecordIds", from: null, to: ["L-2026-001"] },
      { field: "document.sourceText", from: null, to: "Generate KP for lead L-2026-001" }
    ]);
    const generatedKp = await executeAssistantAction({
      action: generateKpAction,
      now: new Date("2026-05-21T00:00:00.000Z"),
      existingLeadIds: ["L-2026-001"],
      createLead: async (lead) => ({ id: "unused", ...lead }),
      generateKpDocument: documentStore.create
    });

    expect(generatedKp).toEqual({
      status: "executed",
      actionType: "generate_kp",
      documentId: "D-20260521-message-2",
      recordId: expect.stringMatching(/^generated-document-record-/)
    });
    await expect(documentStore.list("workspace-1")).resolves.toMatchObject([
      {
        documentId: "D-20260521-message-2",
        docxAttachmentId: "memory-generated-docx-1",
        pdfAttachmentId: "memory-generated-pdf-1",
        sourceRecordIds: ["L-2026-001"]
      }
    ]);

    const kpSentUpdates: unknown[] = [];
    const markKpSentAction = createAction("mark_kp_sent", "message-3", [
      { field: "lead.selectedRecordIds", from: null, to: ["L-2026-001"] },
      { field: "lead.sourceText", from: null, to: "Mark KP sent for lead L-2026-001" }
    ]);
    const markedKpSent = await executeAssistantAction({
      action: markKpSentAction,
      now: new Date("2026-05-21T10:30:00.000Z"),
      existingLeadIds: ["L-2026-001"],
      createLead: async (lead) => ({ id: "unused", ...lead }),
      markKpSent: async (update) => {
        kpSentUpdates.push(update);
        return { id: "lead-record-1", ...update };
      }
    });

    expect(markedKpSent).toEqual({
      status: "executed",
      actionType: "mark_kp_sent",
      leadId: "L-2026-001",
      recordId: "lead-record-1"
    });
    expect(kpSentUpdates).toEqual([
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

    const createdFollowups: Awaited<ReturnType<typeof createTodayFollowupViewModel>> = [];
    const scheduleFollowupAction = createAction("schedule_followup", "message-4", [
      { field: "followup.sourceText", from: null, to: "Follow up with lead L-2026-001 today" }
    ]);
    const scheduledFollowup = await executeAssistantAction({
      action: scheduleFollowupAction,
      now: new Date("2026-05-21T00:00:00.000Z"),
      existingLeadIds: ["L-2026-001"],
      createLead: async (lead) => ({ id: "unused", ...lead }),
      scheduleFollowup: async (followup) => ({ id: "followup-record-1", ...followup })
    });

    expect(scheduledFollowup).toEqual({
      status: "executed",
      actionType: "schedule_followup",
      followupId: "F-20260521-message-4",
      recordId: "followup-record-1"
    });
    createdFollowups.push(
      ...createTodayFollowupViewModel(
        [
          {
            id: "followup-record-1",
            workspaceId: "workspace-1",
            followupId: "F-20260521-message-4",
            rawInput: "Follow up with lead L-2026-001 today",
            requestedByUserId: "user-1"
          }
        ],
        { workspaceId: "workspace-1", today: new Date("2026-05-21T12:00:00.000Z") }
      )
    );
    expect(createdFollowups).toEqual([
      {
        id: "followup-record-1",
        followupId: "F-20260521-message-4",
        dueDateLabel: "2026-05-21",
        rawInput: "Follow up with lead L-2026-001 today",
        requestedByUserId: "user-1",
        status: "pending"
      }
    ]);
  });
});

function createAction(
  actionType: AssistantActionType,
  messageId: string,
  changes: AssistantActionWriteDraft["preview"]["changes"]
): AssistantActionWriteDraft {
  return {
    workspaceId: "workspace-1",
    threadId: "thread-1",
    messageId,
    actionType,
    preview: {
      actionType,
      summary: `${actionType} preview`,
      changes,
      warnings: [],
      requiresConfirmation: true
    },
    status: "awaiting_confirmation",
    requestedByUserId: "user-1"
  };
}
