import { parsePlaceholders } from "./placeholders";

export type RenderDocumentTemplateResult = {
  content: string;
  usedPlaceholders: string[];
  missingPlaceholders: string[];
};

export function renderDocumentTemplate(
  template: string,
  values: Record<string, string | number | null | undefined>
): RenderDocumentTemplateResult {
  const usedPlaceholders = parsePlaceholders(template);
  const missingPlaceholders: string[] = [];
  const content = template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, rawName: string) => {
    const name = rawName.trim();
    const value = values[name];

    if (value === null || value === undefined || String(value).length === 0) {
      missingPlaceholders.push(name);
      return "";
    }

    return String(value);
  });

  return {
    content,
    usedPlaceholders,
    missingPlaceholders: Array.from(new Set(missingPlaceholders)).sort()
  };
}
