"use server";

import { revalidatePath } from "next/cache";
import { createKpSentLeadUpdate, createLeadIntakeDraft, createTelegramLeadIntakeDraft } from "@app/core";
import { appendWorkspacePromptContext, createOpenAiAssistantLeadParserClient } from "@app/assistant";
import { prisma } from "@app/db";
import { getWorkspaceSession } from "../../workspace-session";
import { getClientMaterialAnalysisSetting, getWorkspacePeopleContextSetting } from "../settings/ai-intake/ai-intake-store";
import { createLeadFromIntakeDraft } from "./lead-intake-store";
import { replaceLeadSummaryInRawInput } from "./lead-summary-regeneration";
import { translateLeadSummary, type LeadSummaryTranslationResult } from "./lead-summary-translation";

export async function translateLeadSummaryAction(input: { text: string; targetLanguage: "ru" | "de" }): Promise<LeadSummaryTranslationResult> {
  return translateLeadSummary({
    text: input.text,
    targetLanguage: input.targetLanguage,
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_TRANSLATION_MODEL || "gpt-4.1-mini"
  });
}

export async function createManualLeadAction(formData: FormData): Promise<void> {
  const session = await getWorkspaceSession();
  const draft = createLeadIntakeDraft({
    source: "web",
    clientName: getOptionalFormValue(formData, "clientName"),
    email: getOptionalFormValue(formData, "email"),
    phone: getOptionalFormValue(formData, "phone"),
    requestType: getOptionalFormValue(formData, "requestType"),
    projectAddress: getOptionalFormValue(formData, "projectAddress"),
    bgfM2: getOptionalFormValue(formData, "bgfM2"),
    rawInput: getOptionalFormValue(formData, "rawInput")
  });

  await createLeadFromIntakeDraft({
    workspaceId: session.workspaceId,
    now: new Date(),
    draft
  });
  revalidatePath("/leads");
}

export async function createTelegramLeadAction(formData: FormData): Promise<void> {
  const session = await getWorkspaceSession();
  const draft = createTelegramLeadIntakeDraft({
    fromName: getOptionalFormValue(formData, "telegramFromName"),
    messageText: getRequiredFormValue(formData, "telegramMessageText"),
    messageUrl: getOptionalFormValue(formData, "telegramMessageUrl")
  });

  await createLeadFromIntakeDraft({
    workspaceId: session.workspaceId,
    now: new Date(),
    draft
  });
  revalidatePath("/leads");
}

export async function updateLeadAction(formData: FormData): Promise<void> {
  const session = await getWorkspaceSession();
  const id = getRequiredFormValue(formData, "id");
  const inlineFieldName = getOptionalFormValue(formData, "inlineFieldName");
  const inlineFieldOwner = getOptionalFormValue(formData, "inlineFieldOwner");

  if (inlineFieldName) {
    await updateLeadInlineField({
      workspaceId: session.workspaceId,
      id,
      fieldName: inlineFieldName,
      fieldOwner: inlineFieldOwner,
      value: getOptionalFormValue(formData, inlineFieldName)
    });
    revalidatePath("/leads");
    revalidatePath("/clients");
    return;
  }

  await updateLeadLinkedClientFields({
    workspaceId: session.workspaceId,
    id,
    clientName: getOptionalFormValue(formData, "clientName"),
    email: getOptionalFormValue(formData, "email"),
    phone: getOptionalFormValue(formData, "phone"),
    messenger: getOptionalFormValue(formData, "messenger"),
    source: getOptionalFormValue(formData, "source")
  });

  await prisma.lead.update({
    where: { id, workspaceId: session.workspaceId },
    data: {
      clientRecordId: getOptionalFormValue(formData, "clientRecordId"),
      temperature: getOptionalFormValue(formData, "temperature"),
      requestType: getOptionalFormValue(formData, "requestType"),
      urgency: getOptionalFormValue(formData, "urgency"),
      budgetEur: getOptionalDecimalFormValue(formData, "budgetEur"),
      desiredStart: getOptionalDateFormValue(formData, "desiredStart"),
      desiredMoveIn: getOptionalDateFormValue(formData, "desiredMoveIn"),
      bgfM2: getOptionalDecimalFormValue(formData, "bgfM2"),
      wohnflaecheM2: getOptionalDecimalFormValue(formData, "wohnflaecheM2"),
      projectAddress: getOptionalFormValue(formData, "projectAddress"),
      isStandard: getOptionalBooleanFormValue(formData, "isStandard"),
      status: getRequiredFormValue(formData, "status"),
      rawInput: getOptionalFormValue(formData, "rawInput"),
      missingData: parseMissingData(getOptionalFormValue(formData, "missingData")),
      kpGeneratedDocumentId: getOptionalFormValue(formData, "kpGeneratedDocumentId"),
      kpSentDate: getOptionalDateFormValue(formData, "kpSentDate"),
      followup1Date: getOptionalDateFormValue(formData, "followup1Date"),
      followupStatus: getOptionalFormValue(formData, "followupStatus"),
      outcome: getOptionalFormValue(formData, "outcome"),
      outcomeReason: getOptionalFormValue(formData, "outcomeReason"),
      projectRecordId: getOptionalFormValue(formData, "projectRecordId")
    }
  });
  revalidatePath("/leads");
}

export async function deleteLeadAction(formData: FormData): Promise<void> {
  const session = await getWorkspaceSession();
  const id = getRequiredFormValue(formData, "id");
  const lead = await prisma.lead.findUnique({
    where: { id, workspaceId: session.workspaceId },
    select: { id: true, leadId: true }
  });

  if (!lead) {
    throw new Error("Lead was not found.");
  }

  await prisma.$transaction([
    prisma.leadContextEntity.deleteMany({ where: { workspaceId: session.workspaceId, leadRecordId: lead.id } }),
    prisma.crmCalendarAction.deleteMany({ where: { workspaceId: session.workspaceId, leadRecordId: lead.id } }),
    prisma.lead.delete({ where: { id: lead.id, workspaceId: session.workspaceId } }),
    prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        actorUserId: session.userId,
        action: "lead.delete",
        targetType: "Lead",
        targetId: lead.leadId,
        metadata: { leadRecordId: lead.id }
      }
    })
  ]);
  revalidatePath("/leads");
  revalidatePath("/today");
}

export async function markLeadKpSentAction(formData: FormData): Promise<void> {
  const session = await getWorkspaceSession();
  const id = getRequiredFormValue(formData, "id");

  await prisma.lead.update({
    where: { id, workspaceId: session.workspaceId },
    data: createKpSentLeadUpdate(new Date())
  });
  revalidatePath("/leads");
  revalidatePath("/today");
}

export async function undoLeadKpSentAction(formData: FormData): Promise<void> {
  const session = await getWorkspaceSession();
  const id = getRequiredFormValue(formData, "id");

  await prisma.lead.update({
    where: { id, workspaceId: session.workspaceId },
    data: {
      kpSentDate: null,
      followup1Date: null,
      followupStatus: null
    }
  });
  revalidatePath("/leads");
  revalidatePath("/today");
}

export async function regenerateLeadSummaryAction(formData: FormData): Promise<void> {
  const session = await getWorkspaceSession();
  const id = getRequiredFormValue(formData, "id");
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to regenerate lead summary.");
  }

  const lead = await prisma.lead.findUnique({
    where: { id, workspaceId: session.workspaceId },
    select: {
      id: true,
      leadId: true,
      displayName: true,
      rawInput: true,
      requestType: true,
      projectAddress: true,
      bgfM2: true,
      budgetEur: true,
      desiredStart: true,
      desiredMoveIn: true,
      missingData: true,
      client: {
        select: {
          email: true,
          phone: true
        }
      }
    }
  });

  if (!lead) {
    throw new Error("Lead was not found.");
  }

  const [clientMaterialAnalysisSetting, workspacePeopleContextSetting] = await Promise.all([
    getClientMaterialAnalysisSetting(session.workspaceId),
    getWorkspacePeopleContextSetting(session.workspaceId)
  ]);
  const missingData = normalizeMissingData(lead.missingData);
  const leadContext = [
    `Lead ID: ${lead.leadId}`,
    `Lead name: ${lead.displayName ?? "unknown"}`,
    `Request type: ${lead.requestType ?? "unknown"}`,
    `Project address: ${lead.projectAddress ?? "unknown"}`,
    `BGF m2: ${lead.bgfM2 ?? "unknown"}`,
    `Budget EUR: ${lead.budgetEur ?? "unknown"}`,
    `Desired start: ${lead.desiredStart ? lead.desiredStart.toISOString().slice(0, 10) : "unknown"}`,
    `Desired move-in: ${lead.desiredMoveIn ? lead.desiredMoveIn.toISOString().slice(0, 10) : "unknown"}`,
    `Email: ${lead.client?.email ?? "unknown"}`,
    `Phone: ${lead.client?.phone ?? "unknown"}`,
    `Missing data: ${missingData.length > 0 ? missingData.join(", ") : "none"}`
  ].join("\n");
  const parser = createOpenAiAssistantLeadParserClient({
    apiKey,
    model: clientMaterialAnalysisSetting.model || process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
    prompt: appendWorkspacePromptContext({
      basePrompt: clientMaterialAnalysisSetting.prompt,
      peopleContext: workspacePeopleContextSetting.prompt,
      leadContext,
      actionContext: "Regenerate the lead summary from the current lead data and original source materials. Keep existing facts grounded."
    })
  });
  const parsed = await parser.parseLead({
    text: [leadContext, "", "Original source material:", lead.rawInput ?? ""].join("\n"),
    receivedAt: new Date().toISOString(),
    attachments: []
  });
  const leadSummary = parsed.leadSummary || parsed.summary;

  await prisma.lead.update({
    where: { id, workspaceId: session.workspaceId },
    data: {
      rawInput: replaceLeadSummaryInRawInput(lead.rawInput, leadSummary)
    }
  });

  revalidatePath("/leads");
}

async function updateLeadInlineField(input: {
  workspaceId: string;
  id: string;
  fieldName: string;
  fieldOwner: string | null;
  value: string | null;
}) {
  if (input.fieldOwner === "client") {
    await updateLinkedClientInlineField(input);
    return;
  }

  const data = createLeadInlineUpdate(input.fieldName, input.value);
  await prisma.lead.update({
    where: { id: input.id, workspaceId: input.workspaceId },
    data
  });
}

async function updateLeadLinkedClientFields(input: {
  workspaceId: string;
  id: string;
  clientName: string | null;
  email: string | null;
  phone: string | null;
  messenger: string | null;
  source: string | null;
}) {
  const lead = await prisma.lead.findUnique({
    where: { id: input.id, workspaceId: input.workspaceId },
    select: { clientRecordId: true }
  });

  if (!lead?.clientRecordId) {
    return;
  }

  await prisma.client.updateMany({
    where: { id: lead.clientRecordId, workspaceId: input.workspaceId },
    data: {
      ...(input.clientName ? { name: input.clientName } : {}),
      email: input.email,
      phone: input.phone,
      whatsapp: input.messenger,
      source: input.source
    }
  });
}

async function updateLinkedClientInlineField(input: {
  workspaceId: string;
  id: string;
  fieldName: string;
  value: string | null;
}) {
  const lead = await prisma.lead.findUnique({
    where: { id: input.id, workspaceId: input.workspaceId },
    select: { clientRecordId: true }
  });

  if (!lead?.clientRecordId) {
    throw new Error("This lead is not linked to a client yet.");
  }

  const data = createClientInlineUpdate(input.fieldName, input.value);
  const result = await prisma.client.updateMany({
    where: { id: lead.clientRecordId, workspaceId: input.workspaceId },
    data
  });

  if (result.count === 0) {
    throw new Error("Linked client was not found.");
  }
}

function createLeadInlineUpdate(fieldName: string, value: string | null) {
  switch (fieldName) {
    case "temperature":
      return { temperature: value };
    case "requestType":
      return { requestType: value };
    case "urgency":
      return { urgency: value };
    case "budgetEur":
      return { budgetEur: value };
    case "bgfM2":
      return { bgfM2: value };
    case "wohnflaecheM2":
      return { wohnflaecheM2: value };
    case "status":
      if (!value) {
        throw new Error("status is required.");
      }
      return { status: value };
    case "projectAddress":
      return { projectAddress: value };
    case "followupStatus":
      return { followupStatus: value };
    case "outcome":
      return { outcome: value };
    default:
      throw new Error(`Inline editing is not supported for ${fieldName}.`);
  }
}

function createClientInlineUpdate(fieldName: string, value: string | null) {
  switch (fieldName) {
    case "clientName":
      if (!value) {
        throw new Error("clientName is required.");
      }
      return { name: value };
    case "email":
      return { email: value };
    case "phone":
      return { phone: value };
    case "messenger":
      return { whatsapp: value };
    case "source":
      return { source: value };
    default:
      throw new Error(`Inline client editing is not supported for ${fieldName}.`);
  }
}

function getOptionalFormValue(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getRequiredFormValue(formData: FormData, key: string): string {
  const value = getOptionalFormValue(formData, key);
  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

function getOptionalDecimalFormValue(formData: FormData, key: string): string | null {
  const value = getOptionalFormValue(formData, key);
  return value;
}

function getOptionalDateFormValue(formData: FormData, key: string): Date | null {
  const value = getOptionalFormValue(formData, key);
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function getOptionalBooleanFormValue(formData: FormData, key: string): boolean | null {
  const value = getOptionalFormValue(formData, key);
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

function parseMissingData(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeMissingData(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item).trim()).filter(Boolean);
}
