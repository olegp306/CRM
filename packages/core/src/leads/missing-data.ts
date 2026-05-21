export type LeadMissingDataInput = {
  clientName?: string | null;
  requestType?: string | null;
  projectAddress?: string | null;
  bgfM2?: number | null;
};

export type LeadMissingField = "clientName" | "requestType" | "projectAddress" | "bgfM2";

export function detectLeadMissingData(input: LeadMissingDataInput): LeadMissingField[] {
  const missing: LeadMissingField[] = [];

  if (!input.clientName?.trim()) {
    missing.push("clientName");
  }

  if (!input.requestType?.trim()) {
    missing.push("requestType");
  }

  if (!input.projectAddress?.trim()) {
    missing.push("projectAddress");
  }

  if (input.requestType === "new_build" && typeof input.bgfM2 !== "number") {
    missing.push("bgfM2");
  }

  return missing;
}
