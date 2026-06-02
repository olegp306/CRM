export type LeadDisplayMetadataInput = {
  clientName?: string | null;
  projectAddress?: string | null;
  requestType?: string | null;
  leadSummary?: string | null;
};

export type LeadDisplayMetadata = {
  displayName: string | null;
  language: string | null;
  country: string | null;
  searchTags: string[];
};

export function createLeadDisplayMetadata(input: LeadDisplayMetadataInput): LeadDisplayMetadata {
  const client = clean(input.clientName);
  const request = clean(input.requestType);
  const context = [input.projectAddress, input.leadSummary, request, client].filter(Boolean).join(" ");
  const place = extractPlace(input.projectAddress ?? input.leadSummary ?? "");
  const language = detectLanguage(context);
  const country = detectCountry(context);
  const inWord = language === "ru" ? "в" : "in";
  const titleParts = [client, request].filter(Boolean);
  const baseTitle = titleParts.join(" - ");
  const displayName = baseTitle || place ? `${baseTitle}${place ? ` ${inWord} ${place}` : ""}`.trim() : null;

  return {
    displayName,
    language,
    country,
    searchTags: createSearchTags([client, request, place, country].filter((value): value is string => Boolean(value)))
  };
}

function extractPlace(value: string): string | null {
  const text = value.trim();
  if (!text) {
    return null;
  }

  const russianCity = /(Москва|Сочи|Санкт-Петербург|Казань|Екатеринбург|Новосибирск|Краснодар|Ростов-на-Дону)/i.exec(text)?.[1];
  if (russianCity) {
    return russianCity;
  }

  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const withoutCountry = parts.filter((part) => !/^(Deutschland|Germany|Россия|Russia)$/i.test(part));
  const cityCandidate = withoutCountry.find((part) => /^[A-ZÄÖÜ][A-Za-zÄÖÜäöüß -]+$/.test(part) && !/\d/.test(part));
  if (cityCandidate) {
    return cityCandidate;
  }

  const addressCityCandidate = /,\s*([A-ZÄÖÜ][A-Za-zÄÖÜäöüß -]+)(?:,\s*(?:Deutschland|Germany))?$/i.exec(text)?.[1];
  if (addressCityCandidate) {
    return addressCityCandidate.trim();
  }

  return withoutCountry.at(-1) ?? null;
}

function detectLanguage(value: string): string | null {
  if (/[А-Яа-яЁё]/.test(value)) {
    return "ru";
  }

  if (/\b(Deutschland|Germany|München|Munich|Berlin|Bayern|Westfalen|Bad Aibling|Neubau|EFH)\b/i.test(value)) {
    return "de";
  }

  return null;
}

function detectCountry(value: string): string | null {
  if (/\b(Deutschland|Germany|München|Munich|Berlin|Bayern|Westfalen|Bad Aibling)\b/i.test(value)) {
    return "Germany";
  }

  if (/(Россия|Russia|Москва|Сочи|Санкт-Петербург|Казань|Екатеринбург|Новосибирск|Краснодар|Ростов-на-Дону)/i.test(value)) {
    return "Russia";
  }

  return null;
}

function createSearchTags(values: string[]): string[] {
  const tags = values
    .flatMap((value) => value.split(/[,\n]/))
    .map((value) => slugify(value))
    .filter(Boolean);

  return [...new Set(tags)];
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zа-яё0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "");
}

function clean(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
