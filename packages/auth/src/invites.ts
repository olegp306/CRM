export type InviteStatus = "pending" | "accepted" | "expired";

export type InviteLifecycleInput = {
  acceptedAt: Date | null;
  expiresAt: Date;
};

export function createInviteToken(randomBytes = defaultRandomBytes): string {
  return base64UrlEncode(randomBytes(32));
}

export function getInviteStatus(invite: InviteLifecycleInput, now = new Date()): InviteStatus {
  if (invite.acceptedAt) {
    return "accepted";
  }

  if (invite.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }

  return "pending";
}

function defaultRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function base64UrlEncode(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
