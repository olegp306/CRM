const RU_REMINDER_WORD =
  /(?:\u043d\u0430\u043f\u043e\u043c\u043d\u0438|\u043d\u0430\u043f\u043e\u043c\u0438\u043d|\u0437\u0430\u043f\u043b\u0430\u043d\u0438\u0440\u0443\u0439|\u043f\u043e\u0441\u0442\u0430\u0432\u044c\s+\u043d\u0430\u043f\u043e\u043c\u0438\u043d)/i;

const EN_REMINDER_WORD = /\b(follow[-\s]?up|remind|reminder|schedule)\b/i;

export type LeadReminderDraft = {
  summary: string;
  dueAt: Date | null;
  dueText: string | null;
  recurrence: "yearly" | null;
  calendarStatus: "crm_followup_scheduled" | "needs_date";
};

export function isReminderRequest(content: string): boolean {
  const text = content.trim();
  if (!text) {
    return false;
  }

  return EN_REMINDER_WORD.test(text) || RU_REMINDER_WORD.test(text);
}

export function createLeadReminderDraft(content: string, options: { now: Date } = { now: new Date() }): LeadReminderDraft {
  const text = content.trim();
  const due = extractReminderDueDate(text, options.now);
  const summary = normalizeReminderSummary(text, due.matchedText);
  const recurrence = /\b(every year|yearly|annually)\b/i.test(text) || /(?:каждый\s+год|ежегодно|раз\s+в\s+год)/i.test(text) ? "yearly" : null;

  return {
    summary,
    dueAt: due.date,
    dueText: due.label,
    recurrence,
    calendarStatus: due.date ? "crm_followup_scheduled" : "needs_date"
  };
}

export function createReminderHistorySummary(content: string, options: { now: Date } = { now: new Date() }): string {
  const draft = createLeadReminderDraft(content, options);

  if (!draft.dueAt) {
    return `Reminder requested: ${truncateReminderText(draft.summary)}`;
  }

  const recurrence = draft.recurrence === "yearly" ? " Repeats yearly." : "";
  return `Reminder scheduled: ${truncateReminderText(draft.summary)}. Due: ${formatReminderDateTime(draft.dueAt)}.${recurrence}`;
}

export function createReminderUserResponse(leadId: string, content: string, options: { now: Date } = { now: new Date() }): string {
  const draft = createLeadReminderDraft(content, options);

  if (!draft.dueAt) {
    return `I can save this reminder for lead ${leadId}, but I need a date or time first. For example: remind me tomorrow to call the client.`;
  }

  const recurrence = draft.recurrence === "yearly" ? " It is marked as yearly." : "";
  return `Scheduled this reminder on lead ${leadId}: ${draft.summary}. Due: ${formatReminderDateTime(draft.dueAt)}.${recurrence} I also saved it to the lead history.`;
}

export function formatReminderDateTime(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function extractReminderDueDate(text: string, now: Date): { date: Date | null; label: string | null; matchedText: string | null } {
  if (/послезавтра/i.test(text)) {
    return { date: createDateAtHour(addDays(now, 2), 9), label: "day after tomorrow", matchedText: RegExp.lastMatch || "послезавтра" };
  }

  if (/\b(tomorrow)\b/i.test(text) || /завтра/i.test(text)) {
    return { date: createDateAtHour(addDays(now, 1), 9), label: "tomorrow", matchedText: RegExp.lastMatch || "tomorrow" };
  }

  if (/\b(today)\b/i.test(text) || /сегодня/i.test(text)) {
    return { date: createDateAtHour(now, 9), label: "today", matchedText: RegExp.lastMatch || "today" };
  }

  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (iso) {
    return {
      date: createUtcDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 9),
      label: iso[0],
      matchedText: iso[0]
    };
  }

  const dotted = /\b(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?\b/.exec(text);
  if (dotted) {
    const year = dotted[3] ? Number(dotted[3]) : resolveMonthDayYear(now, Number(dotted[2]) - 1, Number(dotted[1]));
    return {
      date: createUtcDate(year, Number(dotted[2]) - 1, Number(dotted[1]), 9),
      label: dotted[0],
      matchedText: dotted[0]
    };
  }

  const monthName = /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december|января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i.exec(
    text
  );
  if (monthName) {
    const monthIndex = getMonthIndex(monthName[2]);
    const day = Number(monthName[1]);
    return {
      date: createUtcDate(resolveMonthDayYear(now, monthIndex, day), monthIndex, day, 9),
      label: monthName[0],
      matchedText: monthName[0]
    };
  }

  return { date: null, label: null, matchedText: null };
}

function normalizeReminderSummary(text: string, matchedDueText: string | null): string {
  let summary = text
    .replace(/^\s*(?:remind(?:\s+me)?|schedule|follow[-\s]?up|set\s+a\s+reminder)\b[:,\s-]*/i, "")
    .replace(/^\s*(?:напомни|запланируй|поставь\s+напоминание|запомни)[:,\s-]*/i, "")
    .replace(/^\s*(?:me|мне)\b[:,\s-]*/i, "")
    .replace(/\b(to|about|that)\b\s*/i, "")
    .replace(/(?:каждый\s+год|ежегодно|раз\s+в\s+год|\bevery year\b|\byearly\b|\bannually\b)/gi, "")
    .trim();

  if (matchedDueText) {
    summary = summary.replace(matchedDueText, "").trim();
  }

  summary = summary
    .replace(/\b(?:today|tomorrow)\b|сегодня|завтра|послезавтра/gi, "")
    .replace(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\.\d{1,2}(?:\.\d{4})?\b/g, "")
    .replace(/(?:\d{1,2})\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/gi, "")
    .replace(/^\s*(?:to|что|о том,? что|про|about)\s+/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return summary || text.trim();
}

function truncateReminderText(text: string): string {
  return text.length > 180 ? `${text.slice(0, 177).trimEnd()}...` : text;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function createDateAtHour(date: Date, hour: number): Date {
  return createUtcDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour);
}

function createUtcDate(year: number, month: number, day: number, hour: number): Date {
  return new Date(Date.UTC(year, month, day, hour, 0, 0, 0));
}

function resolveMonthDayYear(now: Date, month: number, day: number): number {
  const currentYear = now.getUTCFullYear();
  const candidate = createUtcDate(currentYear, month, day, 9);
  return candidate.getTime() >= now.getTime() ? currentYear : currentYear + 1;
}

function getMonthIndex(value: string): number {
  const normalized = value.toLowerCase();
  const months = [
    ["january", "января"],
    ["february", "февраля"],
    ["march", "марта"],
    ["april", "апреля"],
    ["may", "мая"],
    ["june", "июня"],
    ["july", "июля"],
    ["august", "августа"],
    ["september", "сентября"],
    ["october", "октября"],
    ["november", "ноября"],
    ["december", "декабря"]
  ];

  const index = months.findIndex((items) => items.includes(normalized));
  return index >= 0 ? index : 0;
}
