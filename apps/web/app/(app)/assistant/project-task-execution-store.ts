import type { UpdateProjectTaskFromAssistantInput, UpdatedProjectTaskRecord } from "@app/assistant";

const globalForAssistantProjectTasks = globalThis as typeof globalThis & {
  assistantProjectTaskUpdates?: UpdatedProjectTaskRecord[];
};

function getStore() {
  if (!globalForAssistantProjectTasks.assistantProjectTaskUpdates) {
    globalForAssistantProjectTasks.assistantProjectTaskUpdates = [];
  }

  return globalForAssistantProjectTasks.assistantProjectTaskUpdates;
}

export async function listAssistantProjectTaskUpdates(workspaceId: string): Promise<UpdatedProjectTaskRecord[]> {
  return getStore().filter((taskUpdate) => taskUpdate.workspaceId === workspaceId);
}

export async function updateAssistantProjectTask(
  input: UpdateProjectTaskFromAssistantInput
): Promise<UpdatedProjectTaskRecord> {
  const taskUpdate: UpdatedProjectTaskRecord = {
    id: `task-update-record-${Date.now()}`,
    ...input
  };

  getStore().push(taskUpdate);
  return taskUpdate;
}
