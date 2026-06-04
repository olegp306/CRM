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
