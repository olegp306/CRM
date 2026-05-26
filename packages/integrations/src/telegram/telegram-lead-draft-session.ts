import { getLeadDraftKpStatus, mergeLeadDraftFlowState, type LeadDraftFlowState, type LeadDraftRequiredField } from "@app/assistant";
import type { TelegramLeadIntakeDraft } from "./openai-lead-parser";

export type KpRequiredField = LeadDraftRequiredField;

export type KpRequiredFieldStatus = {
  ready: boolean;
  present: KpRequiredField[];
  missing: KpRequiredField[];
};

export type TelegramLeadDraftSession = {
  chatId: string;
  workspaceId: string;
  startedAt: string;
  updatedAt: string;
  sourceMessageIds: number[];
  telegramDraftMessageId?: number;
  draft: TelegramLeadIntakeDraft;
};

export type TelegramLeadDraftSessionStore = {
  getActive(input: { workspaceId: string; chatId: string }): Promise<TelegramLeadDraftSession | null>;
  getByTelegramMessage?(input: { workspaceId: string; chatId: string; messageId: number }): Promise<TelegramLeadDraftSession | null>;
  save(session: TelegramLeadDraftSession): Promise<void>;
  clear(input: { workspaceId: string; chatId: string }): Promise<void>;
};

export function getKpRequiredFieldStatus(draft: TelegramLeadIntakeDraft, requiredFields = getKpRequiredFields(draft)): KpRequiredFieldStatus {
  return getLeadDraftKpStatus(draft, requiredFields);
}

export function mergeTelegramLeadDraftSession(
  session: TelegramLeadDraftSession,
  update: TelegramLeadIntakeDraft,
  metadata: { receivedAt: string; sourceMessageIds: number[] }
): TelegramLeadDraftSession {
  const mergeResult = mergeLeadDraftFlowState(toLeadDraftFlowState(session.draft, session.sourceMessageIds), toLeadDraftFlowState(update, metadata.sourceMessageIds));
  const draft = toTelegramLeadIntakeDraft(mergeResult.draft, session.draft.telegramSourceExternalId);

  return {
    ...session,
    updatedAt: metadata.receivedAt,
    sourceMessageIds: Array.from(new Set([...session.sourceMessageIds, ...metadata.sourceMessageIds])),
    draft
  };
}

export function createTelegramLeadDraftSession(input: {
  chatId: string;
  workspaceId: string;
  receivedAt: string;
  sourceMessageIds: number[];
  draft: TelegramLeadIntakeDraft;
}): TelegramLeadDraftSession {
  return {
    chatId: input.chatId,
    workspaceId: input.workspaceId,
    startedAt: input.receivedAt,
    updatedAt: input.receivedAt,
    sourceMessageIds: input.sourceMessageIds,
    draft: input.draft
  };
}

export function isPossibleDifferentLead(session: TelegramLeadDraftSession, update: TelegramLeadIntakeDraft): boolean {
  const clientChanged = hasDifferentText(session.draft.clientName, update.clientName);
  const addressChanged = hasDifferentText(session.draft.projectAddress, update.projectAddress);

  return clientChanged && addressChanged;
}

export function createMemoryTelegramLeadDraftSessionStore(): TelegramLeadDraftSessionStore {
  const sessions = new Map<string, TelegramLeadDraftSession>();

  return {
    async getActive({ workspaceId, chatId }) {
      return sessions.get(createSessionKey(workspaceId, chatId)) ?? null;
    },
    async getByTelegramMessage({ workspaceId, chatId, messageId }) {
      const session = sessions.get(createSessionKey(workspaceId, chatId));

      return session?.telegramDraftMessageId === messageId ? session : null;
    },
    async save(session) {
      sessions.set(createSessionKey(session.workspaceId, session.chatId), session);
    },
    async clear({ workspaceId, chatId }) {
      sessions.delete(createSessionKey(workspaceId, chatId));
    }
  };
}

function getKpRequiredFields(draft: TelegramLeadIntakeDraft): KpRequiredField[] {
  return draft.requestType === "new_build"
    ? ["clientName", "requestType", "projectAddress", "bgfM2"]
    : ["clientName", "requestType", "projectAddress"];
}

function hasDifferentText(current: string | null | undefined, next: string | null | undefined): boolean {
  const currentText = normalizeComparableText(current);
  const nextText = normalizeComparableText(next);

  return Boolean(currentText && nextText && currentText !== nextText);
}

function normalizeComparableText(value: string | null | undefined): string {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function createSessionKey(workspaceId: string, chatId: string): string {
  return `${workspaceId}:${chatId}`;
}

function toLeadDraftFlowState(draft: TelegramLeadIntakeDraft, sourceMessageIds: number[]): LeadDraftFlowState {
  return {
    clientName: draft.clientName,
    email: draft.email,
    phone: draft.phone,
    requestType: draft.requestType,
    projectAddress: draft.projectAddress,
    bgfM2: draft.bgfM2,
    rawInput: draft.rawInput,
    missingData: draft.missingData,
    sourceExternalIds: sourceMessageIds.map(String),
    temperature: draft.temperature,
    isStandard: draft.isStandard
  };
}

function toTelegramLeadIntakeDraft(draft: LeadDraftFlowState, telegramSourceExternalId: string): TelegramLeadIntakeDraft {
  return {
    source: "telegram",
    clientName: draft.clientName ?? null,
    email: draft.email ?? null,
    phone: draft.phone ?? null,
    requestType: draft.requestType ?? null,
    projectAddress: draft.projectAddress ?? null,
    bgfM2: draft.bgfM2 ?? null,
    rawInput: draft.rawInput,
    missingData: draft.missingData,
    isStandard: Boolean(draft.isStandard),
    telegramSourceExternalId,
    temperature: draft.temperature ?? "unknown"
  };
}
