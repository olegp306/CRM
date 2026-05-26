import { createKpSentLeadUpdate, createLeadIntakeDraft, getNextBusinessId, type LeadMissingField } from "@app/core";
import { advanceActionConfirmation, type ActionConfirmationStatus } from "./confirmation-state";
import type { AssistantActionWriteDraft } from "./persistence";

export type CreateLeadFromAssistantInput = {
  workspaceId: string;
  leadId: string;
  status: "new" | "needs_data";
  rawInput: string;
  clientName?: string | null;
  requestType?: string | null;
  projectAddress?: string | null;
  bgfM2?: number | null;
  email?: string | null;
  phone?: string | null;
  missingData?: LeadMissingField[];
  isStandard?: boolean;
  temperature?: "cold" | "warm" | "hot" | "unknown";
};

export type CreatedLeadRecord = Omit<CreateLeadFromAssistantInput, "status"> & {
  id: string;
  status: string;
};

export type ScheduleFollowupFromAssistantInput = {
  workspaceId: string;
  followupId: string;
  rawInput: string;
  requestedByUserId: string;
};

export type CreatedFollowupRecord = ScheduleFollowupFromAssistantInput & {
  id: string;
};

export type UpdateProjectTaskFromAssistantInput = {
  workspaceId: string;
  taskUpdateId: string;
  projectIds: string[];
  rawInput: string;
  requestedByUserId: string;
};

export type UpdatedProjectTaskRecord = UpdateProjectTaskFromAssistantInput & {
  id: string;
};

export type GenerateKpDocumentFromAssistantInput = {
  workspaceId: string;
  documentId: string;
  documentType: "kp";
  sourceRecordIds: string[];
  rawInput: string;
  fieldSnapshot?: {
    clientName?: string | null;
    requestType?: string | null;
    projectAddress?: string | null;
    bgfM2?: number | null;
    email?: string | null;
    phone?: string | null;
    missingData?: string[];
  };
  requestedByUserId: string;
};

export type GeneratedKpDocumentRecord = GenerateKpDocumentFromAssistantInput & {
  id: string;
  docxAttachmentId?: string;
  pdfAttachmentId?: string;
};

export type MarkKpSentFromAssistantInput = {
  workspaceId: string;
  leadId: string;
  status: "kp_sent";
  kpSentDate: Date;
  followup1Date: Date;
  followupStatus: "planned";
  requestedByUserId: string;
};

export type MarkedKpSentLeadRecord = MarkKpSentFromAssistantInput & {
  id: string;
};

export type ExecuteAssistantActionInput = {
  action: AssistantActionWriteDraft;
  now: Date;
  existingLeadIds: string[];
  createLead(input: CreateLeadFromAssistantInput): Promise<CreatedLeadRecord>;
  scheduleFollowup?(input: ScheduleFollowupFromAssistantInput): Promise<CreatedFollowupRecord>;
  updateProjectTask?(input: UpdateProjectTaskFromAssistantInput): Promise<UpdatedProjectTaskRecord>;
  generateKpDocument?(input: GenerateKpDocumentFromAssistantInput): Promise<GeneratedKpDocumentRecord>;
  markKpSent?(input: MarkKpSentFromAssistantInput): Promise<MarkedKpSentLeadRecord>;
};

export type ExecuteAssistantActionResult =
  | {
      status: Extract<ActionConfirmationStatus, "executed">;
      leadId: string;
      recordId: string;
      documentId?: string;
      pdfAttachmentId?: string;
      docxAttachmentId?: string;
      documentError?: string;
    }
  | {
      status: Extract<ActionConfirmationStatus, "executed">;
      actionType: "schedule_followup";
      followupId: string;
      recordId: string;
    }
  | {
      status: Extract<ActionConfirmationStatus, "executed">;
      actionType: "update_project_task";
      taskUpdateId: string;
      recordId: string;
    }
  | {
      status: Extract<ActionConfirmationStatus, "executed">;
      actionType: "generate_kp";
      documentId: string;
      recordId: string;
    }
  | {
      status: Extract<ActionConfirmationStatus, "executed">;
      actionType: "mark_kp_sent";
      leadId: string;
      recordId: string;
    };

export async function executeAssistantAction({
  action,
  now,
  existingLeadIds,
  createLead,
  scheduleFollowup,
  updateProjectTask,
  generateKpDocument,
  markKpSent
}: ExecuteAssistantActionInput): Promise<ExecuteAssistantActionResult> {
  const confirmedStatus = advanceActionConfirmation(action.status, "confirm");

  if (action.actionType === "create_lead") {
    const rawInput = getPreviewChangeValue(action, "lead.sourceText");
    const draft = createLeadIntakeDraft({
      source: "web",
      clientName: extractClientName(rawInput),
      email: extractEmail(rawInput),
      phone: extractPhone(rawInput),
      requestType: inferRequestType(rawInput),
      projectAddress: extractProjectAddress(rawInput),
      bgfM2: extractBgfM2(rawInput),
      rawInput
    });
    const leadId = getNextBusinessId({ kind: "lead", now, existingIds: existingLeadIds });
    const lead = await createLead({
      workspaceId: action.workspaceId,
      leadId,
      status: draft.missingData.length > 0 ? "needs_data" : "new",
      rawInput,
      clientName: draft.clientName,
      requestType: draft.requestType,
      projectAddress: draft.projectAddress,
      bgfM2: draft.bgfM2,
      email: draft.email,
      phone: draft.phone,
      missingData: draft.missingData,
      isStandard: draft.isStandard,
      temperature: "warm"
    });
    const executedStatus = advanceActionConfirmation(confirmedStatus, "execute");

    if (executedStatus !== "executed") {
      throw new Error(`Assistant action ${action.messageId} did not execute`);
    }

    const generatedDocumentResult = generateKpDocument
      ? await generateKpDocument({
          workspaceId: action.workspaceId,
          documentId: createDocumentId(now, action.messageId),
          documentType: "kp",
          sourceRecordIds: [lead.leadId],
          rawInput,
          fieldSnapshot: {
            clientName: draft.clientName,
            requestType: draft.requestType,
            projectAddress: draft.projectAddress,
            bgfM2: draft.bgfM2,
            email: draft.email,
            phone: draft.phone,
            missingData: draft.missingData
          },
          requestedByUserId: action.requestedByUserId
        })
          .then((document) => ({ document, error: null }))
          .catch((error: unknown) => ({ document: null, error: error instanceof Error ? error.message : String(error) }))
      : null;
    const generatedDocument = generatedDocumentResult?.document ?? null;
    const documentError = generatedDocumentResult?.error ?? null;

    return {
      status: executedStatus,
      leadId: lead.leadId,
      recordId: lead.id,
      ...(generatedDocument
        ? {
            documentId: generatedDocument.documentId,
            pdfAttachmentId: generatedDocument.pdfAttachmentId,
            docxAttachmentId: generatedDocument.docxAttachmentId
          }
        : {}),
      ...(documentError ? { documentError } : {})
    };
  }

  if (action.actionType === "schedule_followup") {
    if (!scheduleFollowup) {
      throw new Error("Assistant action schedule_followup is missing an execution port");
    }

    const rawInput = getPreviewChangeValue(action, "followup.sourceText");
    const followup = await scheduleFollowup({
      workspaceId: action.workspaceId,
      followupId: createFollowupId(now, action.messageId),
      rawInput,
      requestedByUserId: action.requestedByUserId
    });
    const executedStatus = advanceActionConfirmation(confirmedStatus, "execute");

    if (executedStatus !== "executed") {
      throw new Error(`Assistant action ${action.messageId} did not execute`);
    }

    return {
      status: executedStatus,
      actionType: "schedule_followup",
      followupId: followup.followupId,
      recordId: followup.id
    };
  }

  if (action.actionType === "update_project_task") {
    if (!updateProjectTask) {
      throw new Error("Assistant action update_project_task is missing an execution port");
    }

    const rawInput = getPreviewChangeValue(action, "task.sourceText");
    const taskUpdate = await updateProjectTask({
      workspaceId: action.workspaceId,
      taskUpdateId: createTaskUpdateId(now, action.messageId),
      projectIds: getPreviewChangeStringArray(action, "project.selectedRecordIds"),
      rawInput,
      requestedByUserId: action.requestedByUserId
    });
    const executedStatus = advanceActionConfirmation(confirmedStatus, "execute");

    if (executedStatus !== "executed") {
      throw new Error(`Assistant action ${action.messageId} did not execute`);
    }

    return {
      status: executedStatus,
      actionType: "update_project_task",
      taskUpdateId: taskUpdate.taskUpdateId,
      recordId: taskUpdate.id
    };
  }

  if (action.actionType === "generate_kp") {
    if (!generateKpDocument) {
      throw new Error("Assistant action generate_kp is missing an execution port");
    }

    const rawInput = getPreviewChangeValue(action, "document.sourceText");
    const document = await generateKpDocument({
      workspaceId: action.workspaceId,
      documentId: createDocumentId(now, action.messageId),
      documentType: "kp",
      sourceRecordIds: getPreviewChangeStringArray(action, "document.selectedRecordIds"),
      rawInput,
      requestedByUserId: action.requestedByUserId
    });
    const executedStatus = advanceActionConfirmation(confirmedStatus, "execute");

    if (executedStatus !== "executed") {
      throw new Error(`Assistant action ${action.messageId} did not execute`);
    }

    return {
      status: executedStatus,
      actionType: "generate_kp",
      documentId: document.documentId,
      recordId: document.id
    };
  }

  if (action.actionType === "mark_kp_sent") {
    if (!markKpSent) {
      throw new Error("Assistant action mark_kp_sent is missing an execution port");
    }

    const leadId = getSinglePreviewRecordId(action, "lead.selectedRecordIds");
    const update = createKpSentLeadUpdate(now);
    const lead = await markKpSent({
      workspaceId: action.workspaceId,
      leadId,
      ...update,
      requestedByUserId: action.requestedByUserId
    });
    const executedStatus = advanceActionConfirmation(confirmedStatus, "execute");

    if (executedStatus !== "executed") {
      throw new Error(`Assistant action ${action.messageId} did not execute`);
    }

    return {
      status: executedStatus,
      actionType: "mark_kp_sent",
      leadId: lead.leadId,
      recordId: lead.id
    };
  }

  throw new Error(`Unsupported assistant action ${action.actionType}`);
}

function getPreviewChangeValue(action: AssistantActionWriteDraft, field: string): string {
  const change = action.preview.changes.find((item) => item.field === field);

  if (typeof change?.to !== "string" || change.to.trim().length === 0) {
    throw new Error(`Assistant action ${action.actionType} is missing ${field}`);
  }

  return change.to.trim();
}

function extractEmail(text: string): string | null {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
}

function extractClientName(text: string): string | null {
  const nameBeforeEmail = text.match(/(?:зовут|name is)?\s*([A-ZА-ЯЁ][A-Za-zА-Яа-яЁёÀ-ž-]+(?:\s+[A-ZА-ЯЁ][A-Za-zА-Яа-яЁёÀ-ž-]+){1,3})\s*,\s*(?:contact\s+)?[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return nameBeforeEmail?.[1]
    ?.replace(/^(?:меня\s+зовут|name\s+is)\s+/i, "")
    .replace(/^(?:Neubau|new build)\s+/i, "")
    .replace(/^(?:EFH|for)\s+/i, "")
    .replace(/^for\s+/i, "")
    .trim() ?? null;
}

function extractPhone(text: string): string | null {
  return text.match(/\+?\d[\d\s().-]{6,}\d/)?.[0]?.trim() ?? null;
}

function inferRequestType(text: string): string | null {
  if (/\b(new build|new_build|neubau|efh)\b/i.test(text) || /новый\s+дом|ефх/i.test(text)) {
    return "new_build";
  }

  if (/\b(renovation|sanierung|umbau|altbau)\b/i.test(text) || /ремонт|реконструкц/i.test(text)) {
    return "renovation";
  }

  return null;
}

function extractBgfM2(text: string): number | null {
  const match = text.match(/\bBGF\b[^\d]{0,12}(\d{2,5}(?:[,.]\d+)?)/i) ?? text.match(/(\d{2,5}(?:[,.]\d+)?)\s*(?:m2|m²|qm)\b/i);
  if (!match?.[1]) {
    return null;
  }

  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function extractProjectAddress(text: string): string | null {
  const inPlaceWithStreet = text.match(/\bin\s+([A-Z][A-Za-zÀ-ž -]+),\s*([A-Z][A-Za-zÀ-ž]+(?:weg|strasse|straße|allee|platz|ring|gasse)\s+\d+[A-Za-z]?)/);
  if (inPlaceWithStreet?.[1] && inPlaceWithStreet[2]) {
    return `${inPlaceWithStreet[1].trim()}, ${inPlaceWithStreet[2].trim()}`;
  }

  const street = text.match(/\b([A-Z][A-Za-zÀ-ž]+(?:weg|strasse|straße|allee|platz|ring|gasse)\s+\d+[A-Za-z]?(?:\s+[A-Z][A-Za-zÀ-ž -]+)?)/);
  return street?.[1]?.trim() ?? null;
}

function getPreviewChangeStringArray(action: AssistantActionWriteDraft, field: string): string[] {
  const change = action.preview.changes.find((item) => item.field === field);

  if (!Array.isArray(change?.to) || change.to.some((item) => typeof item !== "string")) {
    throw new Error(`Assistant action ${action.actionType} is missing ${field}`);
  }

  return change.to;
}

function getSinglePreviewRecordId(action: AssistantActionWriteDraft, field: string): string {
  const values = getPreviewChangeStringArray(action, field).filter((value) => value.trim().length > 0);

  if (values.length !== 1) {
    throw new Error(`Assistant action ${action.actionType} requires exactly one ${field}`);
  }

  return values[0];
}

function createFollowupId(now: Date, messageId: string): string {
  return `F-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${messageId}`;
}

function createTaskUpdateId(now: Date, messageId: string): string {
  return `T-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${messageId}`;
}

function createDocumentId(now: Date, messageId: string): string {
  return `D-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${messageId}`;
}
