const RU_REMINDER_WORD =
  /(?:\u043d\u0430\u043f\u043e\u043c\u043d\u0438|\u043d\u0430\u043f\u043e\u043c\u0438\u043d|\u0437\u0430\u043f\u043b\u0430\u043d\u0438\u0440\u0443\u0439|\u043f\u043e\u0441\u0442\u0430\u0432\u044c\s+(?:\u043d\u0430\u043f\u043e\u043c\u0438\u043d|\u0437\u0430\u0434\u0430\u0447)|\u0437\u0430\u0434\u0430\u0447\u0430|\u0437\u0430\u0444\u043e\u043b\u043b\u043e\u0443\u0430\u043f|\u0444\u043e\u043b\u043b\u043e\u0443\u0430\u043f|\u043f\u0435\u0440\u0435\u0437\u0432\u043e\u043d\u0438\u0442\u044c|\u043f\u043e\u0437\u0432\u043e\u043d\u0438\u0442\u044c|\u043d\u0430\u043f\u0438\u0441\u0430\u0442\u044c|\u043f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c|\u0443\u0437\u043d\u0430\u0442\u044c|\u0441\u043f\u0440\u043e\u0441\u0438\u0442\u044c|\u043d\u0435\s+\u0437\u0430\u0431\u044b\u0442\u044c|\u0435\u0441\u043b\u0438\s+\S+\s+\u043d\u0435\s+\u043e\u0442\u0432\u0435\u0442|\u043a\u043e\u0433\u0434\u0430\s+\S+\s+\u043e\u0442\u0432\u0435\u0442|\u0447\u0435\u0440\u0435\u0437\s+\u043d\u0435\u0434\u0435\u043b\u044e|\u043d\u0430\s+\u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0435\u0439\s+\u043d\u0435\u0434\u0435\u043b\u0435)/i;

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
  return `Scheduled this reminder on lead ${leadId}: ${draft.summary}. Due: ${formatReminderDateTime(draft.dueAt)}.${recurrence} I also saved it to the lead history. Google Calendar sync is not connected yet.`;
}

export function formatReminderDateTime(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function extractReminderDueDate(text: string, now: Date): { date: Date | null; label: string | null; matchedText: string | null } {
  const time = extractReminderTime(text);

  const nextWeekday = /на\s+следующей\s+неделе\s+(?:во?\s+)?(понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье)/i.exec(text);
  if (nextWeekday) {
    const weekday = getRussianWeekdayIndex(nextWeekday[1]);
    return {
      date: createDateAtTime(getDateInNextWeek(now, weekday), time.hour, time.minute),
      label: nextWeekday[0].toLowerCase(),
      matchedText: nextWeekday[0]
    };
  }

  const relativeDays = /(?:через\s+(\d{1,2})\s+(?:день|дня|дней)|\bin\s+(\d{1,2})\s+days?\b)/i.exec(text);
  if (relativeDays) {
    const days = Number(relativeDays[1] ?? relativeDays[2]);
    return { date: createDateAtTime(addDays(now, days), time.hour, time.minute), label: relativeDays[0], matchedText: relativeDays[0] };
  }

  const relativeDayWords = /через\s+(один|два|три|четыре|пять|пару)\s+(?:день|дня|дней)/i.exec(text);
  if (relativeDayWords) {
    const days = getRussianNumberWord(relativeDayWords[1]);
    return { date: createDateAtTime(addDays(now, days), time.hour, time.minute), label: relativeDayWords[0], matchedText: relativeDayWords[0] };
  }

  if (/\b(next week)\b/i.test(text) || /(?:через\s+неделю|на\s+следующей\s+неделе)/i.test(text)) {
    return { date: createDateAtTime(addDays(now, 7), time.hour, time.minute), label: "next week", matchedText: RegExp.lastMatch || "next week" };
  }

  if (/послезавтра/i.test(text)) {
    return { date: createDateAtTime(addDays(now, 2), time.hour, time.minute), label: "day after tomorrow", matchedText: RegExp.lastMatch || "послезавтра" };
  }

  if (/\b(tomorrow)\b/i.test(text) || /завтра/i.test(text)) {
    return { date: createDateAtTime(addDays(now, 1), time.hour, time.minute), label: "tomorrow", matchedText: RegExp.lastMatch || "tomorrow" };
  }

  if (/\b(today)\b/i.test(text) || /сегодня/i.test(text)) {
    return { date: createDateAtTime(now, time.hour, time.minute), label: "today", matchedText: RegExp.lastMatch || "today" };
  }

  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (iso) {
    return {
      date: createUtcDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), time.hour, time.minute),
      label: iso[0],
      matchedText: iso[0]
    };
  }

  const dotted = /\b(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?\b/.exec(text);
  if (dotted) {
    const year = dotted[3] ? Number(dotted[3]) : resolveMonthDayYear(now, Number(dotted[2]) - 1, Number(dotted[1]));
    return {
      date: createUtcDate(year, Number(dotted[2]) - 1, Number(dotted[1]), time.hour, time.minute),
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
      date: createUtcDate(resolveMonthDayYear(now, monthIndex, day), monthIndex, day, time.hour, time.minute),
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
    .replace(/(?:через\s+(?:\d{1,2}|один|два|три|четыре|пять|пару)\s+(?:день|дня|дней)|\bin\s+\d{1,2}\s+days?\b|\bnext week\b|через\s+неделю|на\s+следующей\s+неделе(?:\s+(?:во?\s+)?(?:понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье))?)/gi, "")
    .replace(/(?:\b(?:at)\s*|в\s*)?\d{1,2}:\d{2}\b|(?:в|at)\s+\d{1,2}(?:\s*(?:часов|часа|am|pm))?|(?:утром|утро|в\s+обед|обедом|вечером|вечер)/gi, "")
    .replace(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\.\d{1,2}(?:\.\d{4})?\b/g, "")
    .replace(/(?:\d{1,2})\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/gi, "")
    .replace(/^\s*(?:remind(?:\s+me)?|schedule|follow[-\s]?up|set\s+a\s+reminder)\b[:,\s-]*/i, "")
    .replace(/^\s*(?:напомни|запланируй|поставь\s+напоминание|запомни)[:,\s-]*/i, "")
    .replace(/^\s*(?:me|мне)\b[:,\s-]*/i, "")
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
  return createDateAtTime(date, hour, 0);
}

function createDateAtTime(date: Date, hour: number, minute: number): Date {
  return createUtcDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute);
}

function createUtcDate(year: number, month: number, day: number, hour: number, minute = 0): Date {
  return new Date(Date.UTC(year, month, day, hour, minute, 0, 0));
}

function extractReminderTime(text: string): { hour: number; minute: number } {
  if (/(?:утром|утро)/i.test(text)) {
    return { hour: 10, minute: 0 };
  }

  if (/(?:в\s+обед|обедом)/i.test(text)) {
    return { hour: 13, minute: 0 };
  }

  if (/(?:вечером|вечер)/i.test(text)) {
    return { hour: 17, minute: 0 };
  }

  const colon = /(?:\b(?:at|в)\s*)?(\d{1,2}):(\d{2})\b/i.exec(text);
  if (colon) {
    return { hour: normalizeHour(Number(colon[1]), text), minute: Number(colon[2]) };
  }

  const hourOnly = /(?:\b(?:at|в)\s+)(\d{1,2})(?:\s*(am|pm|часов|часа))?/i.exec(text);
  if (hourOnly) {
    return { hour: normalizeHour(Number(hourOnly[1]), hourOnly[2] ?? text), minute: 0 };
  }

  return { hour: 9, minute: 0 };
}

function normalizeHour(hour: number, marker: string): number {
  if (/\bpm\b/i.test(marker) && hour < 12) {
    return hour + 12;
  }

  if (/\bam\b/i.test(marker) && hour === 12) {
    return 0;
  }

  return Math.min(Math.max(hour, 0), 23);
}

function resolveMonthDayYear(now: Date, month: number, day: number): number {
  const currentYear = now.getUTCFullYear();
  const candidate = createUtcDate(currentYear, month, day, 9);
  return candidate.getTime() >= now.getTime() ? currentYear : currentYear + 1;
}

function getDateInNextWeek(now: Date, weekday: number): Date {
  const currentWeekday = now.getUTCDay();
  const daysUntilNextMonday = ((1 - currentWeekday + 7) % 7) || 7;
  return addDays(now, daysUntilNextMonday + weekday - 1);
}

function getRussianWeekdayIndex(value: string): number {
  const normalized = value.toLowerCase();
  const weekdays = new Map([
    ["понедельник", 1],
    ["вторник", 2],
    ["среду", 3],
    ["четверг", 4],
    ["пятницу", 5],
    ["субботу", 6],
    ["воскресенье", 7]
  ]);
  return weekdays.get(normalized) ?? 1;
}

function getRussianNumberWord(value: string): number {
  const normalized = value.toLowerCase();
  const numbers = new Map([
    ["один", 1],
    ["два", 2],
    ["пару", 2],
    ["три", 3],
    ["четыре", 4],
    ["пять", 5]
  ]);
  return numbers.get(normalized) ?? 1;
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
