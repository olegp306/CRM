export type CrmEntityConfidence = "high" | "medium" | "low";

export type CrmExtractedEntityType = "FACT" | "EVENT" | "FOLLOW_UP" | "PERSON" | "ORGANIZATION" | "TAG";

export type CrmExtractedEntity = {
  type: CrmExtractedEntityType;
  label: string;
  value: string;
  sourceText: string;
  confidence: CrmEntityConfidence;
  leadFieldHint?: string | null;
};

export type CrmExtractedFollowup = CrmExtractedEntity & {
  type: "FOLLOW_UP";
  title: string;
  dueAt: string | null;
  recurrence: "none" | "daily" | "weekly" | "monthly" | "yearly" | null;
  assigneeHint: string | null;
};

export type CrmExtractedEvent = CrmExtractedEntity & {
  type: "EVENT";
  startsAt: string | null;
  recurrence: "none" | "daily" | "weekly" | "monthly" | "yearly" | null;
};

export type CrmExtractedTag = CrmExtractedEntity & {
  type: "TAG";
  normalizedKey: string;
};

export type CrmEntityExtraction = {
  facts: CrmExtractedEntity[];
  events: CrmExtractedEvent[];
  followups: CrmExtractedFollowup[];
  people: CrmExtractedEntity[];
  organizations: CrmExtractedEntity[];
  tags: CrmExtractedTag[];
  leadNaming: {
    displayName: string | null;
    projectPlace: string | null;
    language: string | null;
    country: string | null;
  };
  confidence: {
    overall: CrmEntityConfidence;
  };
  summary: string;
};

export type DeterministicCrmEntityExtractionInput = {
  text: string;
  receivedAt: string;
  timezone?: string;
};

type UnknownRecord = Record<string, unknown>;

const reminderPrefixPattern =
  /^\s*(?:напомни|напоминание|запланируй|поставь\s+задачу|remind(?:\s+me)?|schedule|follow[-\s]?up)(?=$|[\s:,-])[:,\s-]*/i;
const reminderActionPattern =
  /(маякнуть|пингануть|допинать|запросить|проверить|узнать|написать|позвонить|перезвонить|ping|ask|check|write|call|follow up)/i;

export function createDeterministicCrmEntityExtraction(input: DeterministicCrmEntityExtractionInput): CrmEntityExtraction {
  const text = input.text.trim();
  const people = extractPeople(text);
  const followups = extractFollowups(text, input.receivedAt);
  const tags = extractTags(text);
  const events = extractEvents(text, input.receivedAt);
  const facts = extractFacts(text, tags);

  return normalizeCrmEntityExtraction({
    facts,
    events,
    followups,
    people,
    organizations: [],
    tags,
    leadNaming: {
      displayName: null,
      projectPlace: null,
      language: detectLanguage(text),
      country: detectCountry(text)
    },
    confidence: { overall: followups.length || facts.length || tags.length ? "high" : "medium" },
    summary: createExtractionSummary({ facts, events, followups, people, tags })
  });
}

export function normalizeCrmEntityExtraction(value: unknown): CrmEntityExtraction {
  const record = isRecord(value) ? value : {};
  const leadNaming = isRecord(record.leadNaming) ? record.leadNaming : {};
  const confidence = isRecord(record.confidence) ? record.confidence : {};

  return {
    facts: normalizeEntities(record.facts, "FACT"),
    events: normalizeEvents(record.events),
    followups: normalizeFollowups(record.followups),
    people: normalizeEntities(record.people, "PERSON"),
    organizations: normalizeEntities(record.organizations, "ORGANIZATION"),
    tags: normalizeTags(record.tags),
    leadNaming: {
      displayName: nullableString(leadNaming.displayName),
      projectPlace: nullableString(leadNaming.projectPlace),
      language: nullableString(leadNaming.language),
      country: nullableString(leadNaming.country)
    },
    confidence: {
      overall: normalizeConfidence(confidence.overall)
    },
    summary: stringValue(record.summary, "")
  };
}

function normalizeEntities(value: unknown, type: CrmExtractedEntityType): CrmExtractedEntity[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => normalizeEntity(item, type)).filter((item): item is CrmExtractedEntity => Boolean(item));
}

function normalizeEvents(value: unknown): CrmExtractedEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const entity = normalizeEntity(item, "EVENT");
      if (!entity) {
        return null;
      }
      const record = isRecord(item) ? item : {};
      return {
        ...entity,
        type: "EVENT" as const,
        startsAt: nullableString(record.startsAt),
        recurrence: normalizeRecurrence(record.recurrence)
      };
    })
    .filter((item): item is CrmExtractedEvent => Boolean(item));
}

function normalizeFollowups(value: unknown): CrmExtractedFollowup[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const entity = normalizeEntity(item, "FOLLOW_UP");
      if (!entity) {
        return null;
      }
      const record = isRecord(item) ? item : {};
      return {
        ...entity,
        type: "FOLLOW_UP" as const,
        title: stringValue(record.title, entity.value),
        dueAt: nullableString(record.dueAt),
        recurrence: normalizeRecurrence(record.recurrence),
        assigneeHint: nullableString(record.assigneeHint)
      };
    })
    .filter((item): item is CrmExtractedFollowup => Boolean(item));
}

function normalizeTags(value: unknown): CrmExtractedTag[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const entity = normalizeEntity(item, "TAG");
      if (!entity) {
        return null;
      }
      const record = isRecord(item) ? item : {};
      const normalizedKey = stringValue(record.normalizedKey, entity.value);
      return {
        ...entity,
        type: "TAG" as const,
        normalizedKey
      };
    })
    .filter((item): item is CrmExtractedTag => Boolean(item));
}

function normalizeEntity(value: unknown, fallbackType: CrmExtractedEntityType): CrmExtractedEntity | null {
  if (!isRecord(value)) {
    return null;
  }

  const valueText = stringValue(value.value, "");
  const label = stringValue(value.label, valueText);
  if (!label && !valueText) {
    return null;
  }

  return {
    type: normalizeEntityType(value.type, fallbackType),
    label: label || valueText,
    value: valueText || label,
    sourceText: stringValue(value.sourceText, valueText || label),
    confidence: normalizeConfidence(value.confidence),
    leadFieldHint: nullableString(value.leadFieldHint)
  };
}

function extractFollowups(text: string, receivedAt: string): CrmExtractedFollowup[] {
  if (!reminderActionPattern.test(text) && !reminderPrefixPattern.test(text)) {
    return [];
  }

  const title = createFollowupTitle(text);
  return [
    {
      type: "FOLLOW_UP",
      label: title,
      value: title,
      title,
      dueAt: detectDueAt(text, receivedAt),
      recurrence: detectRecurrence(text),
      assigneeHint: extractPeople(text)[0]?.label ?? null,
      sourceText: text,
      confidence: "high"
    }
  ];
}

function createFollowupTitle(text: string): string {
  const withoutPrefix = text.replace(reminderPrefixPattern, "").replace(/^(?:завтра|tomorrow)\s+/i, "");
  const firstSentence = withoutPrefix.split(/[.!?]/)[0]?.trim() ?? withoutPrefix.trim();
  return firstSentence || text.trim();
}

function extractPeople(text: string): CrmExtractedEntity[] {
  const people = new Map<string, CrmExtractedEntity>();
  const patterns = [
    /(^|[\s,.:;!?-])([А-ЯЁ][а-яё]{2,})(?=$|[\s,.:;!?-])/g,
    /\b([A-Z][a-z]{2,})(?:\s+[A-Z][a-z]{2,})?\b/g
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const label = match[2] ?? match[1] ?? match[0];
      if (isIgnoredName(label)) {
        continue;
      }
      people.set(label, {
        type: "PERSON",
        label,
        value: label,
        sourceText: label,
        confidence: "medium"
      });
    }
  }

  return [...people.values()];
}

function extractTags(text: string): CrmExtractedTag[] {
  const definitions: Array<{ pattern: RegExp; label: string; value: string }> = [
    { pattern: /инвестор|investor/i, label: "investor", value: "business_investor" },
    { pattern: /реконструкц|reconstruction/i, label: "reconstruction", value: "project_reconstruction" },
    { pattern: /документ|document/i, label: "documents", value: "needs_documents" },
    { pattern: /джаз|jazz/i, label: "jazz", value: "interest_jazz" },
    { pattern: /земл|участ|plot|land/i, label: "land plot", value: "project_land_plot" }
  ];

  return definitions
    .filter((definition) => definition.pattern.test(text))
    .map((definition) => ({
      type: "TAG",
      label: definition.label,
      value: definition.value,
      normalizedKey: definition.value,
      sourceText: text,
      confidence: "high"
    }));
}

function extractEvents(text: string, receivedAt: string): CrmExtractedEvent[] {
  if (!/(день рождения|birthday|годовщин|anniversary)/i.test(text)) {
    return [];
  }

  const label = /день рождения|birthday/i.test(text) ? "Birthday" : "Anniversary";
  return [
    {
      type: "EVENT",
      label,
      value: label,
      startsAt: detectDueAt(text, receivedAt),
      recurrence: detectRecurrence(text),
      sourceText: text,
      confidence: "medium"
    }
  ];
}

function extractFacts(text: string, tags: CrmExtractedTag[]): CrmExtractedEntity[] {
  if (tags.length === 0 || reminderPrefixPattern.test(text)) {
    return [];
  }

  return [
    {
      type: "FACT",
      label: "CRM note",
      value: text,
      sourceText: text,
      confidence: "medium"
    }
  ];
}

function detectDueAt(text: string, receivedAt: string): string | null {
  if (!/(^|[\s,.:;!?-])(завтра|tomorrow)($|[\s,.:;!?-])/i.test(text)) {
    return null;
  }

  const received = new Date(receivedAt);
  if (Number.isNaN(received.getTime())) {
    return null;
  }

  return new Date(received.getTime() + 24 * 60 * 60 * 1000).toISOString();
}

function detectRecurrence(text: string): CrmExtractedFollowup["recurrence"] {
  if (/(каждый год|ежегодно|yearly|annual|birthday|день рождения)/i.test(text)) {
    return "yearly";
  }
  if (/(каждый месяц|monthly)/i.test(text)) {
    return "monthly";
  }
  if (/(каждую неделю|weekly)/i.test(text)) {
    return "weekly";
  }
  if (/(каждый день|daily)/i.test(text)) {
    return "daily";
  }
  return "none";
}

function createExtractionSummary(input: {
  facts: CrmExtractedEntity[];
  events: CrmExtractedEvent[];
  followups: CrmExtractedFollowup[];
  people: CrmExtractedEntity[];
  tags: CrmExtractedTag[];
}): string {
  return [
    input.followups.length ? `${input.followups.length} follow-up found` : "",
    input.facts.length ? `${input.facts.length} fact found` : "",
    input.events.length ? `${input.events.length} event found` : "",
    input.people.length ? `${input.people.length} person found` : "",
    input.tags.length ? `${input.tags.length} tag found` : ""
  ]
    .filter(Boolean)
    .join(", ");
}

function detectLanguage(text: string): string | null {
  if (/[А-Яа-яЁё]/.test(text)) {
    return "ru";
  }
  if (/\b(Deutschland|Germany|Munich|München|Berlin|Bayern|Westfalen)\b/i.test(text)) {
    return "de";
  }
  return null;
}

function detectCountry(text: string): string | null {
  if (/\b(Deutschland|Germany|Munich|München|Berlin|Bayern|Westfalen)\b/i.test(text)) {
    return "Germany";
  }
  if (/\b(Россия|Москва|Сочи|Санкт-Петербург)\b/i.test(text)) {
    return "Russia";
  }
  return null;
}

function normalizeEntityType(value: unknown, fallback: CrmExtractedEntityType): CrmExtractedEntityType {
  return value === "FACT" || value === "EVENT" || value === "FOLLOW_UP" || value === "PERSON" || value === "ORGANIZATION" || value === "TAG"
    ? value
    : fallback;
}

function normalizeConfidence(value: unknown): CrmEntityConfidence {
  return value === "high" || value === "low" || value === "medium" ? value : "medium";
}

function normalizeRecurrence(value: unknown): CrmExtractedFollowup["recurrence"] {
  return value === "none" || value === "daily" || value === "weekly" || value === "monthly" || value === "yearly" ? value : null;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object";
}

function isIgnoredName(value: string): boolean {
  return /^(Напомни|Он|Она|Telegram|CRM|Client|Lead|FACT|TAG)$/i.test(value);
}
