export type LeadFieldCommandField =
  | "clientName"
  | "email"
  | "phone"
  | "requestType"
  | "projectAddress"
  | "bgfM2"
  | "budgetEur"
  | "desiredStart"
  | "desiredMoveIn"
  | "displayName"
  | "communicationChannel";

export type LeadFieldCommand = {
  kind: "field_update";
  field: LeadFieldCommandField;
  sourceScope: "message" | "attachments" | "any";
  only: boolean;
  valueHint: string | null;
  confidence: "high" | "medium";
};

export type LeadFieldCommandGuideItem = {
  field: LeadFieldCommandField;
  label: string;
  aliases: string[];
  examples: string[];
};

const LEAD_FIELD_COMMAND_GUIDE: LeadFieldCommandGuideItem[] = [
  {
    field: "phone",
    label: "Phone",
    aliases: [
      "phone",
      "mobile",
      "mobile number",
      "contact number",
      "telephone",
      "whatsapp number",
      "\u0442\u0435\u043b\u0435\u0444\u043e\u043d",
      "\u043d\u043e\u043c\u0435\u0440",
      "\u043d\u043e\u043c\u0435\u0440 \u043a\u043b\u0438\u0435\u043d\u0442\u0430",
      "\u043c\u043e\u0431\u0438\u043b\u044c\u043d\u044b\u0439",
      "\u043a\u043e\u043d\u0442\u0430\u043a\u0442",
      "\u043a\u043e\u043d\u0442\u0430\u043a\u0442\u043d\u044b\u0439 \u043d\u043e\u043c\u0435\u0440",
      "\u0432\u0430\u0442\u0441\u0430\u043f",
      "whatsapp"
    ],
    examples: [
      "\u041e\u0431\u043d\u043e\u0432\u0438 \u0442\u0435\u043b\u0435\u0444\u043e\u043d: +49 170 1234567",
      "\u0412\u043e\u0437\u044c\u043c\u0438 \u0441\u043e \u0441\u043a\u0440\u0438\u043d\u0430 \u0442\u043e\u043b\u044c\u043a\u043e \u0442\u0435\u043b\u0435\u0444\u043e\u043d \u043a\u043b\u0438\u0435\u043d\u0442\u0430",
      "Take only the client phone from the screenshot"
    ]
  },
  {
    field: "email",
    label: "Email",
    aliases: ["email", "e-mail", "mail", "email address", "\u043f\u043e\u0447\u0442\u0430", "\u044d\u043c\u0435\u0439\u043b", "\u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u0430\u044f \u043f\u043e\u0447\u0442\u0430"],
    examples: ["\u041e\u0431\u043d\u043e\u0432\u0438 email: irina@example.com", "Take email from this PDF"]
  },
  {
    field: "clientName",
    label: "Client name",
    aliases: ["client name", "customer name", "client", "customer", "contact name", "\u0438\u043c\u044f \u043a\u043b\u0438\u0435\u043d\u0442\u0430", "\u043a\u043b\u0438\u0435\u043d\u0442", "\u0437\u0430\u043a\u0430\u0437\u0447\u0438\u043a", "\u043a\u043e\u043d\u0442\u0430\u043a\u0442\u043d\u043e\u0435 \u043b\u0438\u0446\u043e"],
    examples: ["\u0418\u043c\u044f \u043a\u043b\u0438\u0435\u043d\u0442\u0430: \u0418\u0440\u0438\u043d\u0430 \u0428\u043d\u0430\u0439\u0434\u0435\u0440", "Set client name to Irina Schneider"]
  },
  {
    field: "requestType",
    label: "Request type",
    aliases: ["request type", "request", "scope", "service", "project type", "\u0442\u0438\u043f \u043f\u0440\u043e\u0435\u043a\u0442\u0430", "\u0442\u0438\u043f \u0437\u0430\u043f\u0440\u043e\u0441\u0430", "\u0447\u0442\u043e \u0434\u0435\u043b\u0430\u0435\u043c", "\u0443\u0441\u043b\u0443\u0433\u0430", "\u0441\u043e\u0441\u0442\u0430\u0432 \u0440\u0430\u0431\u043e\u0442"],
    examples: ["\u0422\u0438\u043f \u043f\u0440\u043e\u0435\u043a\u0442\u0430: Neubau EFH", "Set request type to feasibility study"]
  },
  {
    field: "projectAddress",
    label: "Project address",
    aliases: ["project address", "site address", "address", "location", "plot", "site", "\u0430\u0434\u0440\u0435\u0441", "\u0430\u0434\u0440\u0435\u0441 \u0443\u0447\u0430\u0441\u0442\u043a\u0430", "\u0430\u0434\u0440\u0435\u0441 \u043e\u0431\u044a\u0435\u043a\u0442\u0430", "\u0443\u0447\u0430\u0441\u0442\u043e\u043a", "\u043b\u043e\u043a\u0430\u0446\u0438\u044f", "\u043c\u0435\u0441\u0442\u043e \u0443\u0447\u0430\u0441\u0442\u043a\u0430"],
    examples: [
      "\u041f\u043e\u0441\u0442\u0430\u0432\u044c \u0430\u0434\u0440\u0435\u0441 \u0443\u0447\u0430\u0441\u0442\u043a\u0430: Gartenweg 9, Bad Aibling",
      "Update project address to Gartenweg 9"
    ]
  },
  {
    field: "bgfM2",
    label: "BGF",
    aliases: ["bgf", "gross floor area", "sqm", "m2", "m\u00b2", "brutto grundfl\u00e4che", "\u0431\u0433\u0444", "\u043f\u043b\u043e\u0449\u0430\u0434\u044c", "\u043c2", "\u043c\u00b2", "\u043a\u0432\u0430\u0434\u0440\u0430\u0442\u0443\u0440\u0430", "\u0431\u0440\u0443\u0442\u0442\u043e \u043f\u043b\u043e\u0449\u0430\u0434\u044c"],
    examples: ["\u0412\u043e\u0437\u044c\u043c\u0438 BGF \u0441\u043e \u0441\u043a\u0440\u0438\u043d\u0430: 240 \u043c2", "Update gross floor area to 240 sqm"]
  },
  {
    field: "budgetEur",
    label: "Budget EUR",
    aliases: ["budget", "budget eur", "fee budget", "honorar", "cost", "\u0431\u044e\u0434\u0436\u0435\u0442", "\u0441\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u044c", "\u0433\u043e\u043d\u043e\u0440\u0430\u0440", "\u0446\u0435\u043d\u0430"],
    examples: ["\u0411\u044e\u0434\u0436\u0435\u0442 \u043d\u0430 \u0443\u0441\u043b\u0443\u0433\u0438 32000 EUR", "Set budget to 32000 EUR"]
  },
  {
    field: "desiredStart",
    label: "Desired start",
    aliases: ["desired start", "start date", "project start", "start", "\u0441\u0442\u0430\u0440\u0442", "\u043d\u0430\u0447\u0430\u043b\u043e", "\u043a\u043e\u0433\u0434\u0430 \u043d\u0430\u0447\u0430\u0442\u044c", "\u0434\u0430\u0442\u0430 \u0441\u0442\u0430\u0440\u0442\u0430"],
    examples: ["\u0421\u0442\u0430\u0440\u0442 \u043f\u0440\u043e\u0435\u043a\u0442\u0430 \u0432 \u0441\u0435\u043d\u0442\u044f\u0431\u0440\u0435 2026", "Desired start September 2026"]
  },
  {
    field: "desiredMoveIn",
    label: "Desired move-in",
    aliases: ["desired move-in", "move in", "move-in", "deadline", "target date", "\u0432\u044a\u0435\u0437\u0434", "\u043f\u0435\u0440\u0435\u0435\u0437\u0434", "\u0434\u0435\u0434\u043b\u0430\u0439\u043d", "\u043a\u043e\u0433\u0434\u0430 \u0432\u044a\u0435\u0445\u0430\u0442\u044c", "\u0441\u0440\u043e\u043a"],
    examples: ["\u0412\u044a\u0435\u0437\u0434 \u043b\u0435\u0442\u043e\u043c 2027", "Move-in deadline summer 2027"]
  },
  {
    field: "displayName",
    label: "Lead title",
    aliases: ["lead title", "project title", "lead name", "project name", "rename", "\u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435", "\u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043b\u0438\u0434\u0430", "\u0438\u043c\u044f \u043f\u0440\u043e\u0435\u043a\u0442\u0430", "\u043f\u0435\u0440\u0435\u0438\u043c\u0435\u043d\u0443\u0439"],
    examples: ["\u041f\u0435\u0440\u0435\u0438\u043c\u0435\u043d\u0443\u0439 \u043f\u0440\u043e\u0435\u043a\u0442 \u0432 SchneiderTeam EFH", "Rename lead to SchneiderTeam EFH"]
  },
  {
    field: "communicationChannel",
    label: "Communication channel",
    aliases: ["communication channel", "channel", "contact channel", "talk via", "use whatsapp", "\u043a\u0430\u043d\u0430\u043b \u0441\u0432\u044f\u0437\u0438", "\u043e\u0431\u0449\u0430\u0435\u043c\u0441\u044f \u0447\u0435\u0440\u0435\u0437", "\u043f\u0438\u0448\u0435\u043c \u0432", "\u0441\u0432\u044f\u0437\u044c \u0447\u0435\u0440\u0435\u0437"],
    examples: ["\u041f\u043e\u0441\u0442\u0430\u0432\u044c \u043a\u0430\u043d\u0430\u043b \u0441\u0432\u044f\u0437\u0438 WhatsApp", "Set communication channel WhatsApp"]
  }
];

const ACTION_SIGNAL = /(?:\b(?:update|set|replace|take|extract|change|rename|use|save|find)\b|(?:\u043e\u0431\u043d\u043e\u0432\u0438|\u043f\u043e\u0441\u0442\u0430\u0432\u044c|\u0437\u0430\u0434\u0430\u0439|\u0437\u0430\u043c\u0435\u043d\u0438|\u0432\u043e\u0437\u044c\u043c\u0438|\u0434\u043e\u0441\u0442\u0430\u043d\u044c|\u0438\u0437\u0432\u043b\u0435\u043a\u0438|\u0438\u0437\u043c\u0435\u043d\u0438|\u043f\u0435\u0440\u0435\u0438\u043c\u0435\u043d\u0443\u0439|\u043d\u0430\u0437\u043e\u0432\u0438|\u0443\u043a\u0430\u0436\u0438|\u0441\u043e\u0445\u0440\u0430\u043d\u0438|\u043d\u0430\u0439\u0434\u0438))/i;

export function detectLeadFieldCommand(content: string): LeadFieldCommand | null {
  const text = content.trim();
  if (!text) {
    return null;
  }

  const normalized = normalizeText(text);
  const matches = LEAD_FIELD_COMMAND_GUIDE.flatMap((item) =>
    item.aliases.some((alias) => normalized.includes(normalizeText(alias))) ? [item] : []
  );
  const primary = pickPrimaryField(matches, normalized);
  if (!primary) {
    return null;
  }

  const hasActionSignal = ACTION_SIGNAL.test(text);
  if (!hasActionSignal && !startsWithFieldAlias(primary, normalized)) {
    return null;
  }

  return {
    kind: "field_update",
    field: primary.field,
    sourceScope: detectSourceScope(normalized),
    only: /\bonly\b|(?:\u0442\u043e\u043b\u044c\u043a\u043e)|(?:\u043b\u0438\u0448\u044c)/i.test(text),
    valueHint: primary.field === "displayName" ? extractDisplayNameHint(text) : null,
    confidence: hasActionSignal ? "high" : "medium"
  };
}

export function getLeadFieldCommandGuide(): LeadFieldCommandGuideItem[] {
  return LEAD_FIELD_COMMAND_GUIDE.map((item) => ({
    ...item,
    aliases: [...item.aliases],
    examples: [...item.examples]
  }));
}

function pickPrimaryField(matches: LeadFieldCommandGuideItem[], normalized: string): LeadFieldCommandGuideItem | null {
  if (matches.length === 0) {
    return null;
  }

  if (matches.some((match) => match.field === "displayName") && /rename|project title|lead title|\u043f\u0435\u0440\u0435\u0438\u043c\u0435\u043d|\u043d\u0430\u0437\u0432\u0430\u043d/i.test(normalized)) {
    return matches.find((match) => match.field === "displayName") ?? matches[0];
  }

  if (matches.some((match) => match.field === "communicationChannel") && /channel|whatsapp|\u043a\u0430\u043d\u0430\u043b|\u043e\u0431\u0449\u0430\u0435\u043c/i.test(normalized)) {
    return matches.find((match) => match.field === "communicationChannel") ?? matches[0];
  }

  return matches[0];
}

function detectSourceScope(normalized: string): LeadFieldCommand["sourceScope"] {
  if (/screenshot|screen|image|photo|pdf|attachment|file|\u0441\u043a\u0440\u0438\u043d|\u043a\u0430\u0440\u0442\u0438\u043d|\u0444\u043e\u0442\u043e|\u0444\u0430\u0439\u043b|\u043f\u0434\u0444/.test(normalized)) {
    return "attachments";
  }

  return "any";
}

function startsWithFieldAlias(item: LeadFieldCommandGuideItem, normalized: string): boolean {
  return item.aliases.some((alias) => {
    const normalizedAlias = normalizeText(alias);
    return normalized === normalizedAlias || normalized.startsWith(`${normalizedAlias} `) || normalized.startsWith(`${normalizedAlias}:`);
  });
}

function extractDisplayNameHint(text: string): string | null {
  const match =
    /\b(?:rename|set|change|update)\b.*?\b(?:to|as)\s+(.+)$/i.exec(text) ??
    /(?:\u043f\u0435\u0440\u0435\u0438\u043c\u0435\u043d\u0443\u0439|\u043d\u0430\u0437\u043e\u0432\u0438)\s+(?:\u043b\u0438\u0434|\u043f\u0440\u043e\u0435\u043a\u0442)?\s*(?:\u0432|\u043d\u0430)\s+(.+)$/iu.exec(text) ??
    /(?:\u0438\u0437\u043c\u0435\u043d\u0438|\u043f\u043e\u043c\u0435\u043d\u044f\u0439|\u043e\u0431\u043d\u043e\u0432\u0438|\u0437\u0430\u0434\u0430\u0439|\u0443\u0441\u0442\u0430\u043d\u043e\u0432\u0438)\s+(?:\u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435|\u0438\u043c\u044f|\u0437\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a)\s+(?:\u043b\u0438\u0434\u0430|\u043f\u0440\u043e\u0435\u043a\u0442\u0430)?\s*(?:\u043d\u0430|\u0432)\s+(.+)$/iu.exec(text);

  const value = match?.[1]
    ?.trim()
    .replace(/^["'\u00ab\u201c\u201d]+|["'\u00ab\u201c\u201d.,;:!]+$/g, "")
    .replace(/\s+/g, " ");
  return value && value.length <= 120 ? value : null;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}
