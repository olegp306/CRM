import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export type DocxToPdfConverter = {
  convertDocxToPdf(docxBytes: Uint8Array): Promise<Uint8Array>;
};

export class DocxToPdfUnavailableError extends Error {
  constructor(message = "DOCX to PDF conversion is not available.") {
    super(message);
    this.name = "DocxToPdfUnavailableError";
  }
}

const execFileAsync = promisify(execFile);

export function createUnavailableDocxToPdfConverter(message = "DOCX to PDF conversion is not configured."): DocxToPdfConverter {
  return {
    async convertDocxToPdf() {
      throw new DocxToPdfUnavailableError(message);
    }
  };
}

export function createLibreOfficeDocxToPdfConverter(options: { executablePath?: string } = {}): DocxToPdfConverter {
  const executablePath = options.executablePath ?? process.env.SOFFICE_PATH ?? process.env.LIBREOFFICE_PATH ?? "soffice";

  return {
    async convertDocxToPdf(docxBytes) {
      const directory = await mkdtemp(join(tmpdir(), "crm-kp-pdf-"));
      const docxPath = join(directory, "proposal.docx");
      const pdfPath = join(directory, "proposal.pdf");

      try {
        await writeFile(docxPath, docxBytes);
        await execFileAsync(executablePath, ["--headless", "--convert-to", "pdf", "--outdir", directory, docxPath], {
          windowsHide: true,
          timeout: 60_000
        });

        return new Uint8Array(await readFile(pdfPath));
      } catch (error) {
        throw new DocxToPdfUnavailableError(
          error instanceof Error
            ? `DOCX to PDF conversion failed via LibreOffice (${executablePath}): ${error.message}`
            : `DOCX to PDF conversion failed via LibreOffice (${executablePath}).`
        );
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
  };
}
