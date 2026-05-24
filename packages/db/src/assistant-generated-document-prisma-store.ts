import type { GeneratedKpDocumentRecord, GenerateKpDocumentFromAssistantInput } from "@app/assistant";
import { createGeneratedDocumentAttachmentMetadata } from "@app/core";
import type { ObjectStorage } from "@app/core/storage";
import { renderDocxTemplatePackageBytes } from "@app/documents";

export class KpTemplateUnavailableError extends Error {
  constructor(message = "Current KP template is not available.") {
    super(message);
    this.name = "KpTemplateUnavailableError";
  }
}

type GeneratedDocumentRow = {
  id: string;
  workspaceId: string;
  documentType: string;
  sourceType: string;
  sourceId: string;
  docxAttachmentId?: string | null;
  pdfAttachmentId?: string | null;
  inputSnapshot: unknown;
  generatedByUserId?: string | null;
};

type CurrentTemplateRow = {
  id: string;
  name: string;
  currentVersionId: string | null;
  versions?: Array<{
    id: string;
    attachmentId: string;
    version: number;
  }>;
};

type AttachmentRow = {
  id: string;
  workspaceId: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
};

export type AssistantGeneratedDocumentPrismaClientLike = {
  attachment?: {
    create(args: unknown): Promise<{ id: string }>;
    findFirst?(args: unknown): Promise<AttachmentRow | null>;
  };
  documentTemplate?: {
    findFirst(args: unknown): Promise<CurrentTemplateRow | null>;
  };
  generatedDocument: {
    findMany(args: unknown): Promise<GeneratedDocumentRow[]>;
    create(args: unknown): Promise<GeneratedDocumentRow>;
  };
};

export type AssistantGeneratedDocumentStore = {
  list(workspaceId: string): Promise<GeneratedKpDocumentRecord[]>;
  create(input: GenerateKpDocumentFromAssistantInput): Promise<GeneratedKpDocumentRecord>;
};

export function createAssistantGeneratedDocumentPrismaStore(
  client: AssistantGeneratedDocumentPrismaClientLike,
  options: { objectStorage?: ObjectStorage } = {}
): AssistantGeneratedDocumentStore {
  return {
    async list(workspaceId) {
      const rows = await client.generatedDocument.findMany({
        where: { workspaceId, documentType: "kp", sourceType: "assistant" },
        orderBy: { generatedAt: "desc" }
      });

      return rows.map(toGeneratedKpDocumentRecord);
    },

    async create(input) {
      if (!client.attachment) {
        throw new Error("Attachment storage is not available for generated documents.");
      }

      const currentTemplate = await resolveCurrentKpTemplate(client, options.objectStorage, input.workspaceId, input.documentType);
      const renderedTemplate = renderDocxTemplatePackageBytes({
        templateBytes: currentTemplate.bytes,
        values: createKpTemplateValues(input),
        prependParagraphs: createKpDraftNoticeParagraphs(input)
      });
      const docxBody = renderedTemplate.bytes;
      const pdfBody = createMinimalPdfBytes(input.documentId, renderedTemplate.paragraphs);
      const docxMetadata = createGeneratedDocumentAttachmentMetadata({
        workspaceId: input.workspaceId,
        documentId: input.documentId,
        documentType: input.documentType,
        format: "docx",
        createdByUserId: input.requestedByUserId
      });
      const pdfMetadata = createGeneratedDocumentAttachmentMetadata({
        workspaceId: input.workspaceId,
        documentId: input.documentId,
        documentType: input.documentType,
        format: "pdf",
        createdByUserId: input.requestedByUserId
      });

      if (options.objectStorage) {
        await options.objectStorage.putObject({
          key: docxMetadata.storageKey,
          body: docxBody,
          contentType: docxMetadata.mimeType
        });
        await options.objectStorage.putObject({
          key: pdfMetadata.storageKey,
          body: pdfBody,
          contentType: pdfMetadata.mimeType
        });
      }

      const docxAttachment = await client.attachment.create({
        data: { ...docxMetadata, sizeBytes: docxBody.byteLength }
      });
      const pdfAttachment = await client.attachment.create({
        data: { ...pdfMetadata, sizeBytes: pdfBody.byteLength }
      });
      const row = await client.generatedDocument.create({
        data: {
          workspaceId: input.workspaceId,
          documentType: input.documentType,
          templateId: currentTemplate.templateId,
          templateVersionId: currentTemplate.templateVersionId,
          sourceType: "assistant",
          sourceId: input.sourceRecordIds[0] ?? input.documentId,
          docxAttachmentId: docxAttachment.id,
          pdfAttachmentId: pdfAttachment.id,
          status: "generated",
          inputSnapshot: {
            documentId: input.documentId,
            rawInput: input.rawInput,
            sourceRecordIds: input.sourceRecordIds,
            renderedContent: renderedTemplate.paragraphs.join("\n"),
            templateName: currentTemplate.templateName,
            fieldSnapshot: input.fieldSnapshot
          },
          generatedByUserId: input.requestedByUserId
        }
      });

      return toGeneratedKpDocumentRecord(row);
    }
  };
}

async function resolveCurrentKpTemplate(
  client: AssistantGeneratedDocumentPrismaClientLike,
  objectStorage: ObjectStorage | undefined,
  workspaceId: string,
  documentType: string
): Promise<{ templateId: string; templateVersionId: string; templateName: string; bytes: Uint8Array }> {
  if (!client.documentTemplate || !client.attachment?.findFirst || !objectStorage) {
    throw new KpTemplateUnavailableError("Current KP template cannot be loaded because template storage is not configured.");
  }

  const template = await client.documentTemplate.findFirst({
    where: { workspaceId, documentType, isActive: true },
    orderBy: { createdAt: "desc" },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1
      }
    }
  });
  const version = template?.versions?.[0];

  if (!template || !version) {
    throw new KpTemplateUnavailableError("No current KP template is uploaded in Settings > Templates.");
  }

  const attachment = await client.attachment.findFirst({
    where: {
      id: version.attachmentId,
      workspaceId
    }
  });

  if (!attachment) {
    throw new KpTemplateUnavailableError(`Current ${documentType} template attachment is missing.`);
  }

  return {
    templateId: template.id,
    templateVersionId: version.id,
    templateName: template.name,
    bytes: await objectStorage.getObject(attachment.storageKey)
  };
}

function createKpTemplateValues(input: GenerateKpDocumentFromAssistantInput): Record<string, string | number | null | undefined> {
  const fields = input.fieldSnapshot;
  const now = new Date();
  const validUntil = new Date(now);
  validUntil.setDate(validUntil.getDate() + 14);

  return {
    date: formatDate(now),
    client_name: fields?.clientName,
    client_address_line_1: null,
    client_address_line_2: null,
    project_name: input.sourceRecordIds[0] ?? input.documentId,
    project_address: fields?.projectAddress,
    bgf: fields?.bgfM2 === null || fields?.bgfM2 === undefined ? null : String(fields.bgfM2),
    wohnflaeche: null,
    project_type: fields?.requestType,
    lp1_3_net: null,
    lp4_net: null,
    total_net: null,
    mwst: null,
    total_gross: null,
    ms1_net: null,
    ms2_net: null,
    ms3_net: null,
    offer_valid_until: formatDate(validUntil),
    email: fields?.email,
    phone: fields?.phone
  };
}

function createKpDraftNoticeParagraphs(input: GenerateKpDocumentFromAssistantInput): string[] {
  const fields = input.fieldSnapshot;
  const missingData = fields?.missingData?.filter((field) => field.trim().length > 0) ?? [];

  return missingData.length > 0
    ? [
        `DRAFT: This commercial proposal is missing required data: ${missingData.join(", ")}.`,
        "Please add the missing fields manually before sending the final proposal.",
        "Processed lead brief",
        input.rawInput,
        "Prepared proposal text"
      ]
    : [];
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function createMinimalPdfBytes(documentId: string, paragraphs: string[]): Uint8Array {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginLeft = 56;
  const marginTop = 64;
  const marginBottom = 64;
  const fontSize = 10;
  const titleFontSize = 14;
  const lineHeight = 15;
  const maxChars = 92;
  const lines = [`KP document ${documentId}`, ...paragraphs].flatMap((paragraph, index) =>
    wrapPdfLine(toPdfSafeText(paragraph), index === 0 ? 76 : maxChars).map((line, lineIndex) => ({
      text: line,
      fontSize: index === 0 && lineIndex === 0 ? titleFontSize : fontSize
    }))
  );
  const pages: Array<Array<{ text: string; fontSize: number }>> = [[]];
  const maxLinesPerPage = Math.floor((pageHeight - marginTop - marginBottom) / lineHeight);

  for (const line of lines) {
    let page = pages[pages.length - 1];
    if (!page || page.length >= maxLinesPerPage) {
      page = [];
      pages.push(page);
    }
    page.push(line);
  }
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    `2 0 obj << /Type /Pages /Kids [${pages.map((_page, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >> endobj`
  ];
  pages.forEach((page, pageIndex) => {
    const pageObjectId = 3 + pageIndex * 2;
    const contentObjectId = pageObjectId + 1;
    const stream = [
      "BT",
      ...page.map((line, lineIndex) => {
        const y = pageHeight - marginTop - lineIndex * lineHeight;
        return `/F1 ${line.fontSize} Tf ${marginLeft} ${y} Td (${escapePdfText(line.text)}) Tj`;
      }),
      "ET"
    ].join(" ");
    objects.push(
      `${pageObjectId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${
        3 + pages.length * 2
      } 0 R >> >> /Contents ${contentObjectId} 0 R >> endobj`,
      `${contentObjectId} 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`
    );
  });
  objects.push(`${3 + pages.length * 2} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`);
  let body = "%PDF-1.4\n";
  const offsets = [0];

  for (const object of objects) {
    offsets.push(body.length);
    body += `${object}\n`;
  }

  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(body);
}

function escapePdfText(value: string): string {
  return value.replace(/[\\()]/g, "\\$&").replace(/\r?\n/g, " ");
}

function toPdfSafeText(value: string): string {
  return value
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "?")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapPdfLine(value: string, maxChars: number): string[] {
  if (!value) {
    return [];
  }

  const words = value.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) {
      lines.push(current);
    }
    current = word.length > maxChars ? word.slice(0, maxChars) : word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function toGeneratedKpDocumentRecord(row: GeneratedDocumentRow): GeneratedKpDocumentRecord {
  const snapshot = toSnapshot(row.inputSnapshot);

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    documentId: snapshot.documentId,
    documentType: "kp",
    docxAttachmentId: row.docxAttachmentId ?? undefined,
    pdfAttachmentId: row.pdfAttachmentId ?? undefined,
    sourceRecordIds: snapshot.sourceRecordIds,
    rawInput: snapshot.rawInput,
    fieldSnapshot: snapshot.fieldSnapshot,
    requestedByUserId: row.generatedByUserId ?? ""
  };
}

function toSnapshot(value: unknown): {
  documentId: string;
  rawInput: string;
  sourceRecordIds: string[];
  fieldSnapshot?: GenerateKpDocumentFromAssistantInput["fieldSnapshot"];
} {
  if (!value || typeof value !== "object") {
    return { documentId: "", rawInput: "", sourceRecordIds: [] };
  }

  const snapshot = value as Record<string, unknown>;
  return {
    documentId: typeof snapshot.documentId === "string" ? snapshot.documentId : "",
    rawInput: typeof snapshot.rawInput === "string" ? snapshot.rawInput : "",
    sourceRecordIds: Array.isArray(snapshot.sourceRecordIds)
      ? snapshot.sourceRecordIds.filter((item): item is string => typeof item === "string")
      : [],
    fieldSnapshot: toKpFieldSnapshot(snapshot.fieldSnapshot)
  };
}

function toKpFieldSnapshot(value: unknown): GenerateKpDocumentFromAssistantInput["fieldSnapshot"] | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const snapshot = value as Record<string, unknown>;
  return {
    clientName: toOptionalString(snapshot.clientName),
    requestType: toOptionalString(snapshot.requestType),
    projectAddress: toOptionalString(snapshot.projectAddress),
    bgfM2: typeof snapshot.bgfM2 === "number" ? snapshot.bgfM2 : null,
    email: toOptionalString(snapshot.email),
    phone: toOptionalString(snapshot.phone),
    missingData: Array.isArray(snapshot.missingData)
      ? snapshot.missingData.filter((item): item is string => typeof item === "string")
      : []
  };
}

function toOptionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
