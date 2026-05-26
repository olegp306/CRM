const NOTE_COMMAND_PATTERNS = [
  /^\s*(?:record|log|save|note|remember|add\s+(?:a\s+)?note)\b[:,\s-]*(?:that\s+)?/i,
  /^\s*(?:\u0437\u0430\u043f\u0438\u0448\u0438|\u0441\u043e\u0445\u0440\u0430\u043d\u0438|\u0434\u043e\u0431\u0430\u0432\u044c\s+\u0437\u0430\u043c\u0435\u0442\u043a\u0443|\u0437\u0430\u043c\u0435\u0442\u043a\u0430|\u0437\u0430\u0444\u0438\u043a\u0441\u0438\u0440\u0443\u0439)(?=\s|[:,.-]|$)[:,\s-]*(?:\u0447\u0442\u043e\s+)?/i
];

export function isLeadInteractionNoteCommand(content: string): boolean {
  return NOTE_COMMAND_PATTERNS.some((pattern) => pattern.test(content.trim()));
}

export function createLeadInteractionNoteSummary(content: string): string {
  let summary = content.trim();

  for (const pattern of NOTE_COMMAND_PATTERNS) {
    summary = summary.replace(pattern, "").trim();
  }

  return summary || content.trim();
}
