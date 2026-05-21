export const clientStatuses = ["active", "archived"] as const;
export const leadStatuses = ["new", "needs_data", "needs_pricing", "kp_sent", "won", "lost", "archived"] as const;
export const projectStatuses = ["active", "on_hold", "closed", "archived"] as const;

export const clientTypes = ["private", "company"] as const;
export const requestTypes = ["new_build", "renovation", "extension", "other"] as const;
export const leadTemperatures = ["cold", "warm", "hot"] as const;
export const urgencyLevels = ["low", "medium", "high"] as const;

export const crmDictionaries = {
  clientStatuses,
  leadStatuses,
  projectStatuses,
  clientTypes,
  requestTypes,
  leadTemperatures,
  urgencyLevels
} as const;

export type ClientStatus = (typeof clientStatuses)[number];
export type LeadStatus = (typeof leadStatuses)[number];
export type ProjectStatus = (typeof projectStatuses)[number];
export type RequestType = (typeof requestTypes)[number];

export function isClientStatus(value: string): value is ClientStatus {
  return includesValue(clientStatuses, value);
}

export function isLeadStatus(value: string): value is LeadStatus {
  return includesValue(leadStatuses, value);
}

export function isProjectStatus(value: string): value is ProjectStatus {
  return includesValue(projectStatuses, value);
}

function includesValue<const TValues extends readonly string[]>(values: TValues, value: string): value is TValues[number] {
  return values.includes(value as TValues[number]);
}
