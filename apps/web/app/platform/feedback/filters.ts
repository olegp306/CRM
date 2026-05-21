import type { FeedbackItemIntent, FeedbackItemStatus, PlatformFeedbackFilters } from "@app/assistant";

const statuses = new Set<FeedbackItemStatus>(["new", "triaged", "planned", "transferred", "declined", "archived"]);
const types = new Set<FeedbackItemIntent>([
  "support_request",
  "bug_report",
  "feature_request",
  "ux_feedback",
  "permission_blocked"
]);

export type PlatformFeedbackSearchParams = {
  status?: string | string[];
  type?: string | string[];
  appVersion?: string | string[];
};

export function parsePlatformFeedbackFilters(searchParams: PlatformFeedbackSearchParams): PlatformFeedbackFilters {
  const status = firstValue(searchParams.status);
  const type = firstValue(searchParams.type);
  const appVersion = firstValue(searchParams.appVersion);

  return {
    ...(status && statuses.has(status as FeedbackItemStatus) ? { status: status as FeedbackItemStatus } : {}),
    ...(type && types.has(type as FeedbackItemIntent) ? { type: type as FeedbackItemIntent } : {}),
    ...(appVersion && isSemVer(appVersion) ? { appVersion } : {})
  };
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isSemVer(value: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(value);
}
