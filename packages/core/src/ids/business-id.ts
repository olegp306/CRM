export type BusinessIdKind = "client" | "lead" | "project";

const prefixes: Record<BusinessIdKind, string> = {
  client: "C",
  lead: "L",
  project: "P"
};

export type GetNextBusinessIdInput = {
  kind: BusinessIdKind;
  now: Date;
  existingIds: string[];
};

export function getNextBusinessId({ kind, now, existingIds }: GetNextBusinessIdInput): string {
  const prefix = prefixes[kind];
  const year = now.getUTCFullYear();
  const idPrefix = `${prefix}-${year}-`;
  const highestSequence = existingIds.reduce((highest, id) => {
    if (!id.startsWith(idPrefix)) {
      return highest;
    }

    const sequence = Number(id.slice(idPrefix.length));
    return Number.isInteger(sequence) ? Math.max(highest, sequence) : highest;
  }, 0);

  return `${idPrefix}${String(highestSequence + 1).padStart(3, "0")}`;
}
