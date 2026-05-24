export function createAdminEmailAllowlist(value: string | undefined | null): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => normalizeEmail(email))
      .filter(Boolean)
  );
}

export function isAdminEmailAllowed(email: string | undefined | null, allowlist: ReadonlySet<string>): boolean {
  const normalizedEmail = normalizeEmail(email);
  return normalizedEmail.length > 0 && allowlist.has(normalizedEmail);
}

function normalizeEmail(email: string | undefined | null): string {
  return (email ?? "").trim().toLowerCase();
}
