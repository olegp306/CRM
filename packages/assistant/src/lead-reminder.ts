const RU_REMINDER_WORD =
  /(?:\u043d\u0430\u043f\u043e\u043c\u043d\u0438|\u043d\u0430\u043f\u043e\u043c\u0438\u043d|\u0437\u0430\u043f\u043b\u0430\u043d\u0438\u0440\u0443\u0439|\u043f\u043e\u0441\u0442\u0430\u0432\u044c\s+\u043d\u0430\u043f\u043e\u043c\u0438\u043d)/i;

const EN_REMINDER_WORD = /\b(follow[-\s]?up|remind|reminder|schedule)\b/i;

export function isReminderRequest(content: string): boolean {
  const text = content.trim();
  if (!text) {
    return false;
  }

  return EN_REMINDER_WORD.test(text) || RU_REMINDER_WORD.test(text);
}

export function createReminderHistorySummary(content: string): string {
  const text = content.trim();
  const normalized = text.length > 180 ? `${text.slice(0, 177).trimEnd()}...` : text;
  return `Reminder requested: ${normalized}`;
}
