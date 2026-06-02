import type { CrmEntityExtraction } from "./crm-entity-extractor";

export type CrmEntityPersistencePlan = {
  entities: Array<{
    type: string;
    label: string;
    value: string;
    normalizedKey?: string | null;
    sourceText?: string | null;
    confidence: string;
  }>;
  calendarActions: Array<{
    title: string;
    description?: string | null;
    dueAt?: Date | null;
    recurrence?: string | null;
  }>;
  historySummary: string;
};

export function createCrmEntityPersistencePlan(input: {
  leadId: string;
  extraction: CrmEntityExtraction;
}): CrmEntityPersistencePlan {
  const entities = [
    ...input.extraction.facts,
    ...input.extraction.people,
    ...input.extraction.organizations,
    ...input.extraction.tags
  ].map((entity) => ({
    type: entity.type,
    label: entity.label,
    value: entity.value,
    normalizedKey: "normalizedKey" in entity && typeof entity.normalizedKey === "string" ? entity.normalizedKey : null,
    sourceText: entity.sourceText,
    confidence: entity.confidence
  }));

  const followupActions = input.extraction.followups.map((followup) => ({
    title: followup.title,
    description: followup.value,
    dueAt: followup.dueAt ? new Date(followup.dueAt) : null,
    recurrence: followup.recurrence ?? "none"
  }));

  const eventActions = input.extraction.events.map((event) => ({
    title: event.label,
    description: event.value,
    dueAt: event.startsAt ? new Date(event.startsAt) : null,
    recurrence: event.recurrence ?? "none"
  }));

  return {
    entities,
    calendarActions: [...followupActions, ...eventActions],
    historySummary: `${input.extraction.summary} Entities: ${entities.length}. Future actions: ${followupActions.length + eventActions.length}.`
  };
}
