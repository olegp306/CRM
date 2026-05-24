import { inflateRawSync } from "node:zlib";

export type CreateDocxPackageInput = {
  title: string;
  paragraphs: string[];
};

export type RenderDocxTemplatePackageInput = {
  templateBytes: Uint8Array;
  values: Record<string, string | number | null | undefined>;
  prependParagraphs?: string[];
};

export type RenderDocxTemplatePackageResult = {
  bytes: Uint8Array;
  usedPlaceholders: string[];
  missingPlaceholders: string[];
};

type ZipEntry = {
  name: string;
  bytes: Uint8Array;
  crc32: number;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const crcTable = createCrcTable();

export function createDocxPackageBytes(input: CreateDocxPackageInput): Uint8Array {
  const documentXml = createDocumentXml(input);
  const entries: ZipEntry[] = [
    toZipEntry("[Content_Types].xml", createContentTypesXml()),
    toZipEntry("_rels/.rels", createRootRelationshipsXml()),
    toZipEntry("word/document.xml", documentXml),
    toZipEntry("word/_rels/document.xml.rels", createEmptyRelationshipsXml())
  ];

  return createZipArchive(entries);
}

export function renderDocxTemplatePackageBytes(input: RenderDocxTemplatePackageInput): RenderDocxTemplatePackageResult {
  const entries = readZipEntries(input.templateBytes);
  const documentEntry = entries.find((entry) => entry.name === "word/document.xml");

  if (!documentEntry) {
    throw new Error("DOCX template is missing word/document.xml.");
  }

  const documentXml = textDecoder.decode(documentEntry.bytes);
  const usedPlaceholders = parseDocumentPlaceholders(documentXml);
  const missingPlaceholders: string[] = [];
  const renderedXml = documentXml.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, rawName: string) => {
    const name = rawName.trim();
    const value = input.values[name];

    if (value === null || value === undefined || String(value).trim().length === 0) {
      missingPlaceholders.push(name);
      return "";
    }

    return escapeXml(String(value));
  });
  const renderedWithNotice = prependDocumentParagraphs(renderedXml, input.prependParagraphs ?? []);

  const renderedEntries = entries.map((entry) =>
    entry.name === "word/document.xml" ? toZipEntry(entry.name, renderedWithNotice) : toBinaryZipEntry(entry.name, entry.bytes)
  );

  return {
    bytes: createZipArchive(renderedEntries),
    usedPlaceholders,
    missingPlaceholders: Array.from(new Set(missingPlaceholders)).sort()
  };
}

function createDocumentXml(input: CreateDocxPackageInput): string {
  const paragraphs = [input.title, ...input.paragraphs]
    .filter((paragraph) => paragraph.trim().length > 0)
    .map(createParagraphXml)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;
}

function createContentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
}

function createRootRelationshipsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function createEmptyRelationshipsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;
}

function toZipEntry(name: string, content: string): ZipEntry {
  const bytes = textEncoder.encode(content);
  return toBinaryZipEntry(name, bytes);
}

function toBinaryZipEntry(name: string, bytes: Uint8Array): ZipEntry {
  return { name, bytes, crc32: calculateCrc32(bytes) };
}

function createZipArchive(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const localHeader = createLocalFileHeader(entry);
    localParts.push(localHeader, entry.bytes);
    centralParts.push(createCentralDirectoryHeader(entry, offset));
    offset += localHeader.byteLength + entry.bytes.byteLength;
  }

  const centralDirectoryOffset = offset;
  const centralDirectorySize = centralParts.reduce((total, part) => total + part.byteLength, 0);
  const endRecord = createEndOfCentralDirectoryRecord(entries.length, centralDirectorySize, centralDirectoryOffset);

  return concatUint8Arrays([...localParts, ...centralParts, endRecord]);
}

function createLocalFileHeader(entry: ZipEntry): Uint8Array {
  const nameBytes = textEncoder.encode(entry.name);
  const bytes = new Uint8Array(30 + nameBytes.byteLength);
  const view = new DataView(bytes.buffer);

  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint32(14, entry.crc32, true);
  view.setUint32(18, entry.bytes.byteLength, true);
  view.setUint32(22, entry.bytes.byteLength, true);
  view.setUint16(26, nameBytes.byteLength, true);
  view.setUint16(28, 0, true);
  bytes.set(nameBytes, 30);

  return bytes;
}

function readZipEntries(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endOffset = findEndOfCentralDirectory(view);
  const entryCount = view.getUint16(endOffset + 10, true);
  let cursor = view.getUint32(endOffset + 16, true);
  const entries: ZipEntry[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error("Invalid DOCX central directory.");
    }

    const compressionMethod = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const fileNameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);
    const nameBytes = bytes.slice(cursor + 46, cursor + 46 + fileNameLength);
    const name = textDecoder.decode(nameBytes);
    const localFileNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressedBytes = bytes.slice(dataStart, dataStart + compressedSize);
    const content = inflateZipEntry(compressionMethod, compressedBytes);

    entries.push(toBinaryZipEntry(name, content));
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function inflateZipEntry(compressionMethod: number, compressedBytes: Uint8Array): Uint8Array {
  if (compressionMethod === 0) {
    return compressedBytes;
  }

  if (compressionMethod === 8) {
    return new Uint8Array(inflateRawSync(compressedBytes));
  }

  throw new Error(`Unsupported DOCX ZIP compression method: ${compressionMethod}.`);
}

function findEndOfCentralDirectory(view: DataView): number {
  for (let offset = view.byteLength - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      return offset;
    }
  }

  throw new Error("Invalid DOCX ZIP package.");
}

function createCentralDirectoryHeader(entry: ZipEntry, localHeaderOffset: number): Uint8Array {
  const nameBytes = textEncoder.encode(entry.name);
  const bytes = new Uint8Array(46 + nameBytes.byteLength);
  const view = new DataView(bytes.buffer);

  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);
  view.setUint32(16, entry.crc32, true);
  view.setUint32(20, entry.bytes.byteLength, true);
  view.setUint32(24, entry.bytes.byteLength, true);
  view.setUint16(28, nameBytes.byteLength, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, localHeaderOffset, true);
  bytes.set(nameBytes, 46);

  return bytes;
}

function createEndOfCentralDirectoryRecord(
  entryCount: number,
  centralDirectorySize: number,
  centralDirectoryOffset: number
): Uint8Array {
  const bytes = new Uint8Array(22);
  const view = new DataView(bytes.buffer);

  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralDirectorySize, true);
  view.setUint32(16, centralDirectoryOffset, true);
  view.setUint16(20, 0, true);

  return bytes;
}

function concatUint8Arrays(parts: Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;

  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }

  return bytes;
}

function parseDocumentPlaceholders(documentXml: string): string[] {
  const matches = documentXml.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g);
  return Array.from(new Set(Array.from(matches, (match) => match[1].trim()))).sort();
}

function prependDocumentParagraphs(documentXml: string, paragraphs: string[]): string {
  const noticeXml = paragraphs
    .filter((paragraph) => paragraph.trim().length > 0)
    .map(createParagraphXml)
    .join("");

  if (!noticeXml) {
    return documentXml;
  }

  return documentXml.replace(/<w:body>/, `<w:body>${noticeXml}`);
}

function createParagraphXml(paragraph: string): string {
  return `<w:p><w:r><w:t>${escapeXml(paragraph)}</w:t></w:r></w:p>`;
}

function calculateCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createCrcTable(): number[] {
  return Array.from({ length: 256 }, (_value, index) => {
    let crc = index;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }

    return crc >>> 0;
  });
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
