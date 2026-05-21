import type { CreatedFollowupRecord, ScheduleFollowupFromAssistantInput } from "@app/assistant";

const globalForAssistantFollowups = globalThis as typeof globalThis & {
  assistantCreatedFollowups?: CreatedFollowupRecord[];
};

function getStore() {
  if (!globalForAssistantFollowups.assistantCreatedFollowups) {
    globalForAssistantFollowups.assistantCreatedFollowups = [];
  }

  return globalForAssistantFollowups.assistantCreatedFollowups;
}

export async function listAssistantCreatedFollowups(workspaceId: string): Promise<CreatedFollowupRecord[]> {
  return getStore().filter((followup) => followup.workspaceId === workspaceId);
}

export async function createAssistantFollowup(
  input: ScheduleFollowupFromAssistantInput
): Promise<CreatedFollowupRecord> {
  const followup: CreatedFollowupRecord = {
    id: `followup-record-${Date.now()}`,
    ...input
  };

  getStore().push(followup);
  return followup;
}
