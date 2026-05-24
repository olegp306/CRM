import { describe, expect, it } from "vitest";
import { DocxToPdfUnavailableError, createUnavailableDocxToPdfConverter } from "./pdf-converter";

describe("DOCX to PDF converter", () => {
  it("reports a clear unavailable error when no converter is configured", async () => {
    const converter = createUnavailableDocxToPdfConverter("LibreOffice soffice was not found.");

    await expect(converter.convertDocxToPdf(new Uint8Array([1, 2, 3]))).rejects.toThrow(DocxToPdfUnavailableError);
    await expect(converter.convertDocxToPdf(new Uint8Array([1, 2, 3]))).rejects.toThrow("LibreOffice soffice was not found.");
  });
});
