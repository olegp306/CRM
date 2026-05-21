export type DatabaseRuntimeEnv = "development" | "production" | "test" | string | undefined;

export type DatabaseRuntimeInput = {
  databaseUrl?: string;
  nodeEnv?: DatabaseRuntimeEnv;
  runtimeName: string;
};

export function assertDatabaseRuntime({ databaseUrl, nodeEnv, runtimeName }: DatabaseRuntimeInput): void {
  if (databaseUrl) {
    return;
  }

  if (nodeEnv === "test") {
    return;
  }

  const environment = nodeEnv || "development";
  throw new Error(
    `DATABASE_URL is required for ${runtimeName} in ${environment}. Configure Postgres locally or in production instead of using memory fallback.`
  );
}

export function selectDatabaseBackedRuntime<TStore>({
  databaseUrl,
  nodeEnv,
  memoryRuntime,
  databaseRuntime,
  runtimeName = "database-backed runtime"
}: {
  databaseUrl?: string;
  nodeEnv?: DatabaseRuntimeEnv;
  memoryRuntime: TStore;
  databaseRuntime: TStore;
  runtimeName?: string;
}): TStore {
  assertDatabaseRuntime({ databaseUrl, nodeEnv, runtimeName });
  return databaseUrl ? databaseRuntime : memoryRuntime;
}
