"use server";

import { revalidatePath } from "next/cache";
import { createKpSentLeadUpdate, createLeadIntakeDraft, createTelegramLeadIntakeDraft } from "@app/core";
import { prisma } from "@app/db";
import { getWorkspaceSession } from "../../workspace-session";
import { createLeadFromIntakeDraft } from "./lead-intake-store";

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
