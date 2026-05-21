export type EnvInput = Record<string, string | undefined>;

export function validateEnv<const TKeys extends readonly string[]>(
  input: EnvInput,
  requiredKeys: TKeys
): { [K in TKeys[number]]: string } {
  const missing = requiredKeys.filter((key) => !input[key]?.trim());

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return Object.fromEntries(requiredKeys.map((key) => [key, input[key] as string])) as { [K in TKeys[number]]: string };
}
