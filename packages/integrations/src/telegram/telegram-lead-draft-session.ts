import type { TelegramLeadIntakeDraft } from "./openai-lead-parser";

export type KpRequiredField = "clientName" | "requestType" | "projectAddress" | "bgfM2";

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
  const present: KpRequiredField[] = [];
  const missing: KpRequiredField[] = [];

  for (const field of requiredFields) {
    const value = draft[field];
    if (typeof value === "number" ? Number.isFinite(value) : Boolean(value?.trim())) {
      present.push(field);
    } else {
      missing.push(field);
    }
  }

  return {
    ready: missing.length === 0,
    present,
    missing
  };
}

export function mergeTelegramLeadDraftSession(
  session: TelegramLeadDraftSession,
  update: TelegramLeadIntakeDraft,
  metadata: { receivedAt: string; sourceMessageIds: number[] }
): TelegramLeadDraftSession {
  const draft: TelegramLeadIntakeDraft = {
    ...session.draft,
    clientName: mergeText(session.draft.clientName, update.clientName),
    email: mergeText(session.draft.email, update.email),
    phone: mergeText(session.draft.phone, update.phone),
    requestType: mergeText(session.draft.requestType, update.requestType),
    projectAddress: mergeText(session.draft.projectAddress, update.projectAddress),
    bgfM2: session.draft.bgfM2 ?? update.bgfM2,
    rawInput: mergeRawInput(session.draft.rawInput, update.rawInput),
    missingData: mergeMissingData(session.draft, update),
    isStandard: update.isStandard || session.draft.isStandard,
    telegramSourceExternalId: session.draft.telegramSourceExternalId,
    temperature: session.draft.temperature === "unknown" ? update.temperature : session.draft.temperature
  };

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

function mergeText(current: string | null | undefined, next: string | null | undefined): string | null {
  return current?.trim() ? current : next?.trim() ? next : null;
}

function mergeRawInput(current: string, next: string): string {
  return [current.trim(), next.trim()].filter(Boolean).join("\n\n--- draft update ---\n\n");
}

function mergeMissingData(current: TelegramLeadIntakeDraft, update: TelegramLeadIntakeDraft): string[] {
  const merged = {
    ...current,
    clientName: mergeText(current.clientName, update.clientName),
    requestType: mergeText(current.requestType, update.requestType),
    projectAddress: mergeText(current.projectAddress, update.projectAddress),
    bgfM2: current.bgfM2 ?? update.bgfM2
  };
  const requiredMissing = getKpRequiredFieldStatus(merged).missing;
  const parserMissing = [...current.missingData, ...update.missingData].filter((field) => requiredMissing.includes(field as KpRequiredField));

  return Array.from(new Set([...requiredMissing, ...parserMissing]));
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
