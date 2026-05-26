const NOTE_COMMAND_PATTERNS = [
  /^\s*(?:record|log|save|note|remember|add\s+(?:a\s+)?note)\b[:,\s-]*(?:that\s+)?/i,
  /^\s*(?:\u0437\u0430\u043f\u0438\u0448\u0438|\u0441\u043e\u0445\u0440\u0430\u043d\u0438|\u0434\u043e\u0431\u0430\u0432\u044c\s+\u0437\u0430\u043c\u0435\u0442\u043a\u0443|\u0441\u0434\u0435\u043b\u0430\u0439\s+\u043f\u043e\u043c\u0435\u0442\u043a\u0443|\u043f\u043e\u043c\u0435\u0442\u044c|\u0437\u0430\u043c\u0435\u0442\u043a\u0430|\u0437\u0430\u0444\u0438\u043a\u0441\u0438\u0440\u0443\u0439)(?=\s|[:,.-]|$)[:,\s-]*(?:\u0447\u0442\u043e\s+)?/i
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

export function isLeadNaturalContextNote(content: string): boolean {
  const text = content.trim();
  if (text.length < 12) {
    return false;
  }

  if (isLeadInteractionNoteCommand(text) || hasLeadCreationSignal(text) || hasSupportQuestionSignal(text)) {
    return false;
  }

  return getNaturalContextScore(text) >= 2;
}

export function createLeadNaturalContextSummary(content: string): string {
  const text = content.trim();
  const summary = text.length > 180 ? `${text.slice(0, 177).trimEnd()}...` : text;
  return `Client context: ${summary}`;
}

function getNaturalContextScore(content: string): number {
  const signals = [
    /\b(?:met|saw|talked|spoke|visited|prefers|likes|loves|interested|mentioned|said|turns out)\b/i,
    /\b(?:yesterday|today|last week|at the exhibition|at expo|at the meeting|over coffee)\b/i,
    /\b(?:jazz|linkedin|expo|exhibition|coffee|preference|prefers|hobby|family|decision maker)\b/i,
    /(?:\u0432\u0438\u0434\u0435\u043b|\u0432\u0441\u0442\u0440\u0435\u0447|\u043e\u0431\u0449\u0430\u043b|\u0433\u043e\u0432\u043e\u0440\u0438\u043b|\u0441\u043a\u0430\u0437\u0430\u043b|\u0443\u043f\u043e\u043c\u044f\u043d\u0443\u043b|\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442\u0441\u044f|\u043b\u044e\u0431\u0438\u0442|\u043d\u0440\u0430\u0432\u0438\u0442\u0441\u044f|\u0438\u043d\u0442\u0435\u0440\u0435\u0441\u0443\u0435\u0442)/i,
    /(?:\u0432\u0447\u0435\u0440\u0430|\u0441\u0435\u0433\u043e\u0434\u043d\u044f|\u043d\u0430\s+\u0432\u044b\u0441\u0442\u0430\u0432\u043a\u0435|\u043d\u0430\s+expo|\u0437\u0430\s+\u043a\u043e\u0444\u0435|\u043d\u0430\s+\u0432\u0441\u0442\u0440\u0435\u0447\u0435)/i,
    /(?:\u0434\u0436\u0430\u0437|\u0432\u044b\u0441\u0442\u0430\u0432\u043a|\u043a\u043e\u0444\u0435|linkedin|\u0444\u0430\u0441\u0430\u0434|\u043f\u0440\u0435\u0434\u043f\u043e\u0447\u0438\u0442\u0430\u0435\u0442|\u0445\u043e\u0431\u0431\u0438|\u0441\u0435\u043c\u044c\u044f)/i
  ];

  return signals.filter((signal) => signal.test(content)).length;
}

function hasLeadCreationSignal(content: string): boolean {
  return /(\b(?:new lead|create lead|commercial proposal|proposal|request|bgf|address|budget|phone|email)\b|(?:\u0441\u043e\u0437\u0434\u0430\w*\s+\u043b\u0438\u0434|\u0437\u0430\u044f\u0432\u043a|\u043a\u043f|\u043a\u043e\u043c\u043c\u0435\u0440\u0447\u0435\u0441\u043a\w*\s+\u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d|\u0430\u0434\u0440\u0435\u0441|\u0431\u044e\u0434\u0436\u0435\u0442|\u043f\u043b\u043e\u0449\u0430\u0434|\u043f\u043e\u0447\u0442\u0430|\u0442\u0435\u043b\u0435\u0444\u043e\u043d))/i.test(
    content
  );
}

function hasSupportQuestionSignal(content: string): boolean {
  return /(\?|^(?:what|where|when|why|how|can|could|do|does|is)\b|^(?:\u0447\u0442\u043e|\u0433\u0434\u0435|\u043a\u043e\u0433\u0434\u0430|\u043f\u043e\u0447\u0435\u043c\u0443|\u043a\u0430\u043a|\u043c\u043e\u0436\u043d\u043e)\b)/i.test(
    content
  );
}
