export type AssistantModuleContext =
  | "clients"
  | "leads"
  | "projects"
  | "documents"
  | "outreach"
  | "content"
  | "settings"
  | "assistant"
  | "other";

export type AssistantEntityContext = {
  type: string;
  id: string;
};

export type AssistantContextInput = {
  workspaceId: string;
  userId: string;
  role: string;
  route: string;
  module?: AssistantModuleContext;
  entity?: AssistantEntityContext;
  selectedRecordIds?: string[];
};

export type AssistantContext = {
  workspaceId: string;
  userId: string;
  role: string;
  route: string;
  module: AssistantModuleContext;
  entity?: AssistantEntityContext;
  selectedRecordIds: string[];
};

export function captureAssistantContext(input: AssistantContextInput): AssistantContext {
  return {
    workspaceId: input.workspaceId,
    userId: input.userId,
    role: input.role,
    route: input.route.trim() || "/",
    module: input.module ?? "other",
    ...(input.entity ? { entity: input.entity } : {}),
    selectedRecordIds: input.selectedRecordIds ?? []
  };
}
