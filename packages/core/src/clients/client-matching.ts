export type ClientMatchCandidate = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
};

export type ClientMatchInput = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type ClientMatchResult<TClient extends ClientMatchCandidate> =
  | {
      match: TClient;
      reason: "email" | "phone" | "name";
    }
  | {
      match: null;
      reason: "none";
    };

export function findMatchingClient<TClient extends ClientMatchCandidate>(
  clients: readonly TClient[],
  input: ClientMatchInput
): ClientMatchResult<TClient> {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const name = normalizeName(input.name);

  if (email) {
    const match = clients.find((client) => normalizeEmail(client.email) === email);
    if (match) {
      return { match, reason: "email" };
    }
  }

  if (phone) {
    const match = clients.find((client) => normalizePhone(client.phone) === phone);
    if (match) {
      return { match, reason: "phone" };
    }
  }

  if (name) {
    const match = clients.find((client) => normalizeName(client.name) === name);
    if (match) {
      return { match, reason: "name" };
    }
  }

  return { match: null, reason: "none" };
}

function normalizeEmail(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function normalizePhone(value: string | null | undefined): string {
  return value?.replace(/\D/g, "") ?? "";
}

function normalizeName(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}
