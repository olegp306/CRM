import { clientTypes } from "../crm/dictionaries";

export type ClientInput = {
  name?: string | null;
  clientType?: string | null;
  email?: string | null;
  phone?: string | null;
  language?: string | null;
};

export type ClientValidationResult =
  | {
      ok: true;
      value: {
        name: string;
        clientType: string;
        email?: string;
        phone?: string;
        language?: string;
      };
    }
  | {
      ok: false;
      errors: Array<{ field: keyof ClientInput; message: string }>;
    };

export function validateClientInput(input: ClientInput): ClientValidationResult {
  const errors: Array<{ field: keyof ClientInput; message: string }> = [];
  const name = input.name?.trim() ?? "";
  const clientType = input.clientType?.trim() ?? "";

  if (!name) {
    errors.push({ field: "name", message: "Client name is required" });
  }

  if (!clientTypes.includes(clientType as (typeof clientTypes)[number])) {
    errors.push({ field: "clientType", message: "Client type is not supported" });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      name,
      clientType,
      ...optionalTrimmedLower("email", input.email),
      ...optionalTrimmed("phone", input.phone),
      ...optionalTrimmed("language", input.language)
    }
  };
}

function optionalTrimmed(key: "phone" | "language", value: string | null | undefined): Partial<Record<typeof key, string>> {
  const trimmed = value?.trim();
  return trimmed ? { [key]: trimmed } : {};
}

function optionalTrimmedLower(key: "email", value: string | null | undefined): Partial<Record<typeof key, string>> {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? { [key]: trimmed } : {};
}
