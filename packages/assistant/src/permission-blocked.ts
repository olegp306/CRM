import type { AssistantIntent } from "./classify-intent";

export type PermissionBlockedInput = {
  role: string;
  actionType: string;
  moduleContext?: string;
};

export type PermissionBlockedResponse = {
  message: string;
  feedbackType: Extract<AssistantIntent, "permission_blocked">;
  moduleContext?: string;
  role: string;
};

export function getPermissionBlockedResponse({
  role,
  actionType,
  moduleContext
}: PermissionBlockedInput): PermissionBlockedResponse {
  return {
    message: `You do not have permission to perform ${actionType}. I captured this as a product signal.`,
    feedbackType: "permission_blocked",
    moduleContext,
    role
  };
}
