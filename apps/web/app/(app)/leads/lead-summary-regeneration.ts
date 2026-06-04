export function replaceLeadSummaryInRawInput(rawInput: string | null | undefined, leadSummary: string): string {
  const normalizedRawInput = rawInput?.trim() ?? "";
  const normalizedLeadSummary = leadSummary.trim();

  if (!normalizedLeadSummary) {
    return normalizedRawInput;
  }

  const replacement = `Lead summary: ${normalizedLeadSummary}`;
  if (!normalizedRawInput) {
    return replacement;
  }

  if (/^Lead summary:\s*.*$/im.test(normalizedRawInput)) {
    return normalizedRawInput.replace(/^Lead summary:\s*.*$/im, replacement);
  }

  if (/^Summary:\s*.*$/im.test(normalizedRawInput)) {
    return normalizedRawInput.replace(/^Summary:\s*.*$/im, replacement);
  }

  return [normalizedRawInput, replacement].join("\n");
}
