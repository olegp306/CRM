export const AVAILABLE_DOCUMENT_VARIABLES = [
  "date",
  "client_name",
  "client_address_line_1",
  "client_address_line_2",
  "project_name",
  "project_address",
  "bgf",
  "wohnflaeche",
  "project_type",
  "lp1_3_net",
  "lp4_net",
  "total_net",
  "mwst",
  "total_gross",
  "ms1_net",
  "ms2_net",
  "ms3_net",
  "offer_valid_until"
] as const;

export function parsePlaceholders(text: string): string[] {
  const matches = text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g);
  return Array.from(new Set(Array.from(matches, (match) => match[1].trim()))).sort();
}

export function findUnknownPlaceholders(placeholders: string[], allowed: readonly string[]): string[] {
  const allowedSet = new Set(allowed);
  return placeholders.filter((placeholder) => !allowedSet.has(placeholder)).sort();
}
