export type LeadMatchCandidate = {
  leadId: string;
  rawInput?: string | null;
  clientName?: string | null;
  projectAddress?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type IncomingLeadMatchInput = {
  rawInput: string;
  sourceExternalIds?: string[];
  clientName?: string | null;
  projectAddress?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type LeadMatchDecision =
  | { kind: "exact_duplicate"; leadId: string; reason: "source_external_id" | "same_text" }
  | { kind: "likely_update"; leadId: string; reason: string; matchedFields: string[] }
  | { kind: "needs_clarification"; leadId: string; reason: string; matchedFields: string[] }
  | { kind: "new_lead" };

export function decideIncomingLeadMatch({
  incoming,
  candidates
}: {
  incoming: IncomingLeadMatchInput;
  candidates: LeadMatchCandidate[];
}): LeadMatchDecision {
  const exact = candidates.find((candidate) => hasExactSourceMatch(incoming, candidate) || hasSameText(incoming.rawInput, candidate.rawInput));
  if (exact) {
    return {
      kind: "exact_duplicate",
      leadId: exact.leadId,
      reason: hasExactSourceMatch(incoming, exact) ? "source_external_id" : "same_text"
    };
  }

  const scored = candidates
    .map((candidate) => ({ candidate, matchedFields: getMatchedFields(incoming, candidate) }))
    .filter((item) => item.matchedFields.length > 0)
    .sort((left, right) => right.matchedFields.length - left.matchedFields.length);
  const best = scored[0];

  if (!best) {
    return { kind: "new_lead" };
  }

  if (best.matchedFields.length >= 2) {
    return {
      kind: "likely_update",
      leadId: best.candidate.leadId,
      reason: "matched lead identity and project data",
      matchedFields: best.matchedFields
    };
  }

  return {
    kind: "needs_clarification",
    leadId: best.candidate.leadId,
    reason: "partial match",
    matchedFields: best.matchedFields
  };
}

function hasExactSourceMatch(incoming: IncomingLeadMatchInput, candidate: LeadMatchCandidate): boolean {
  const rawInput = candidate.rawInput ?? "";
  return (incoming.sourceExternalIds ?? []).some((sourceExternalId) => rawInput.includes(sourceExternalId));
}

function hasSameText(left: string, right: string | null | undefined): boolean {
  const normalizedLeft = normalizeComparableText(left);
  const normalizedRight = normalizeComparableText(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function getMatchedFields(incoming: IncomingLeadMatchInput, candidate: LeadMatchCandidate): string[] {
  const matched: string[] = [];

  if (hasSameText(incoming.clientName ?? "", candidate.clientName)) {
    matched.push("clientName");
  }

  if (hasSameText(incoming.projectAddress ?? "", candidate.projectAddress)) {
    matched.push("projectAddress");
  }

  if (hasSameText(incoming.email ?? "", candidate.email)) {
    matched.push("email");
  }

  if (normalizePhone(incoming.phone) && normalizePhone(incoming.phone) === normalizePhone(candidate.phone)) {
    matched.push("phone");
  }

  if (matched.length === 0 && incoming.projectAddress && normalizedIncludes(candidate.rawInput, incoming.projectAddress)) {
    matched.push("rawInput");
  }

  return matched;
}

function normalizedIncludes(haystack: string | null | undefined, needle: string): boolean {
  const normalizedHaystack = normalizeComparableText(haystack);
  const normalizedNeedle = normalizeComparableText(needle);
  return Boolean(normalizedHaystack && normalizedNeedle && normalizedHaystack.includes(normalizedNeedle));
}

function normalizeComparableText(value: string | null | undefined): string {
  return value?.trim().toLowerCase().replace(/[^\p{L}\p{N}@.+]+/gu, " ").replace(/\s+/g, " ").trim() ?? "";
}

function normalizePhone(value: string | null | undefined): string {
  return value?.replace(/\D+/g, "") ?? "";
}
