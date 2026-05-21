import { AVAILABLE_DOCUMENT_VARIABLES, findUnknownPlaceholders, parsePlaceholders } from "./placeholders";

export type DocumentTemplateValidationStatus = "valid" | "needs_attention";

export type DocumentTemplateValidationResult = {
  detectedPlaceholders: string[];
  unknownPlaceholders: string[];
  validationStatus: DocumentTemplateValidationStatus;
};

export function validateDocumentTemplate(
  templateText: string,
  allowedVariables: readonly string[] = AVAILABLE_DOCUMENT_VARIABLES
): DocumentTemplateValidationResult {
  const detectedPlaceholders = parsePlaceholders(templateText);
  const unknownPlaceholders = findUnknownPlaceholders(detectedPlaceholders, allowedVariables);

  return {
    detectedPlaceholders,
    unknownPlaceholders,
    validationStatus: unknownPlaceholders.length > 0 ? "needs_attention" : "valid"
  };
}
