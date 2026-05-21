export type AssistantActionType = "create_lead" | "generate_kp" | "schedule_followup" | "update_project_task" | "mark_kp_sent";

export type ActionPreviewChange = {
  field: string;
  from: unknown;
  to: unknown;
};

export type CreateActionPreviewInput = {
  actionType: AssistantActionType;
  summary: string;
  changes: ActionPreviewChange[];
  warnings?: string[];
};

export type ActionPreview = CreateActionPreviewInput & {
  warnings: string[];
  requiresConfirmation: true;
};

export function createActionPreview(input: CreateActionPreviewInput): ActionPreview {
  return {
    actionType: input.actionType,
    summary: input.summary,
    changes: input.changes,
    warnings: input.warnings ?? [],
    requiresConfirmation: true
  };
}
