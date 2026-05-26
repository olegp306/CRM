export type LeadDraftRequiredField = "clientName" | "requestType" | "projectAddress" | "bgfM2";

export type LeadDraftFlowState = {
  leadId?: string;
  clientName?: string | null;
  requestType?: string | null;
  projectAddress?: string | null;
  bgfM2?: number | null;
  email?: string | null;
  phone?: string | null;
  rawInput: string;
  missingData: string[];
  sourceExternalIds: string[];
  temperature?: "cold" | "warm" | "hot" | "unknown";
  isStandard?: boolean;
};

export type LeadDraftKpStatus = {
  ready: boolean;
  present: LeadDraftRequiredField[];
  missing: LeadDraftRequiredField[];
};

export type LeadDraftMergeResult = {
  draft: LeadDraftFlowState;
  missingData: string[];
  kpReady: boolean;
};

export function mergeLeadDraftFlowState(
  current: LeadDraftFlowState,
  update: Partial<LeadDraftFlowState>,
  options: { requiredFields?: LeadDraftRequiredField[] } = {}
): LeadDraftMergeResult {
  const updateSourceIds = update.sourceExternalIds ?? [];
  const draft: LeadDraftFlowState = {
    ...current,
    clientName: mergeText(current.clientName, update.clientName),
    email: mergeText(current.email, update.email),
    phone: mergeText(current.phone, update.phone),
    requestType: mergeText(current.requestType, update.requestType),
    projectAddress: mergeText(current.projectAddress, update.projectAddress),
    bgfM2: current.bgfM2 ?? update.bgfM2 ?? null,
    rawInput: createLeadDraftRawInput(current.rawInput, update.rawInput ?? "", updateSourceIds),
    sourceExternalIds: mergeUnique([...(current.sourceExternalIds ?? []), ...updateSourceIds]),
    temperature: current.temperature === "unknown" ? update.temperature ?? current.temperature : current.temperature ?? update.temperature,
    isStandard: update.isStandard || current.isStandard
  };
  const status = getLeadDraftKpStatus(draft, options.requiredFields);
  const parserMissing = [...(current.missingData ?? []), ...(update.missingData ?? [])].filter(
    (field) => !isRequiredField(field) || status.missing.includes(field)
  );
  const missingData = mergeUnique([...status.missing, ...parserMissing]);

  return {
    draft: {
      ...draft,
      missingData
    },
    missingData,
    kpReady: missingData.length === 0
  };
}

export function getLeadDraftKpStatus(
  draft: Pick<LeadDraftFlowState, LeadDraftRequiredField>,
  requiredFields = getDefaultRequiredFields(draft)
): LeadDraftKpStatus {
  const present: LeadDraftRequiredField[] = [];
  const missing: LeadDraftRequiredField[] = [];

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

export function createLeadDraftRawInput(currentRawInput: string, incomingRawInput: string, sourceExternalIds: string[] = []): string {
  const incomingBlock = [incomingRawInput.trim(), sourceExternalIds.length > 0 ? `Shared sources: ${sourceExternalIds.join(", ")}` : ""]
    .filter(Boolean)
    .join("\n");

  return [currentRawInput.trim(), incomingBlock].filter(Boolean).join("\n\n--- draft update ---\n\n");
}

function getDefaultRequiredFields(draft: Pick<LeadDraftFlowState, "requestType">): LeadDraftRequiredField[] {
  return draft.requestType === "new_build"
    ? ["clientName", "requestType", "projectAddress", "bgfM2"]
    : ["clientName", "requestType", "projectAddress"];
}

function mergeText(current: string | null | undefined, next: string | null | undefined): string | null {
  return current?.trim() ? current : next?.trim() ? next : null;
}

function mergeUnique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function isRequiredField(field: string): field is LeadDraftRequiredField {
  return field === "clientName" || field === "requestType" || field === "projectAddress" || field === "bgfM2";
}
