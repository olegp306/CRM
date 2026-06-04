export type AppendWorkspacePromptContextInput = {
  basePrompt: string;
  peopleContext?: string | null;
  leadContext?: string | null;
  actionContext?: string | null;
};

export function appendWorkspacePromptContext(input: AppendWorkspacePromptContextInput): string {
  const sections = [
    createPromptContextSection("Workspace people and project context", input.peopleContext),
    createPromptContextSection("Current lead context", input.leadContext),
    createPromptContextSection("Current action context", input.actionContext)
  ].filter(Boolean);

  if (sections.length === 0) {
    return input.basePrompt;
  }

  return [input.basePrompt.trim(), ...sections].filter(Boolean).join("\n\n");
}

function createPromptContextSection(title: string, content: string | null | undefined): string | null {
  const normalized = content?.trim();
  return normalized ? `## ${title}\n\n${normalized}` : null;
}
