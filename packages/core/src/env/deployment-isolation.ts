export type DeploymentIsolationEnv = Record<string, string | undefined>;

export function resolveDeploymentEnvironment(env: DeploymentIsolationEnv): string | undefined {
  return env.CRM_DEPLOYMENT_ENV?.trim() || env.NEXT_PUBLIC_CRM_DEPLOYMENT_ENV?.trim() || undefined;
}

export function assertDeploymentDatabaseIsolation(env: DeploymentIsolationEnv): void {
  const rawDeploymentEnvironment = resolveDeploymentEnvironment(env);
  const deploymentEnvironment = normalizeDeploymentEnvironment(rawDeploymentEnvironment);
  const requiresDeploymentConfirmation = isEnabled(env.CRM_REQUIRE_DEPLOYMENT_CONFIRMATION);

  if (requiresDeploymentConfirmation && !deploymentEnvironment) {
    throw new Error("CRM_DEPLOYMENT_ENV must be set to test or production for guarded deployments.");
  }

  if (!deploymentEnvironment) {
    return;
  }

  if (requiresDeploymentConfirmation) {
    const confirmation = normalizeDeploymentEnvironment(env.CRM_DEPLOYMENT_CONFIRMATION);
    if (confirmation !== deploymentEnvironment) {
      throw new Error("CRM_DEPLOYMENT_CONFIRMATION must match CRM_DEPLOYMENT_ENV for guarded deployments.");
    }

    assertTelegramBotEnvironment(env, deploymentEnvironment);
  }

  const databaseName = getDatabaseName(env.DATABASE_URL);
  if (!databaseName) {
    throw new Error(`DATABASE_URL is required when CRM_DEPLOYMENT_ENV is ${deploymentEnvironment}.`);
  }

  const isTestDatabase = /\btest\b|_test\b|\btest_/i.test(databaseName);

  if (deploymentEnvironment === "test" && !isTestDatabase) {
    throw new Error(
      `Refusing to start TEST deployment with non-test database "${databaseName}". Use a separate test database such as ai_crm_test.`
    );
  }

  if (deploymentEnvironment === "production" && isTestDatabase) {
    throw new Error(`Refusing to start PRODUCTION deployment with test database "${databaseName}".`);
  }
}

function assertTelegramBotEnvironment(env: DeploymentIsolationEnv, deploymentEnvironment: "test" | "production"): void {
  if (!env.TELEGRAM_BOT_TOKEN?.trim()) {
    return;
  }

  const botEnvironment = normalizeDeploymentEnvironment(env.TELEGRAM_BOT_ENV);
  if (botEnvironment !== deploymentEnvironment) {
    throw new Error("TELEGRAM_BOT_ENV must match CRM_DEPLOYMENT_ENV for guarded Telegram deployments.");
  }
}

function normalizeDeploymentEnvironment(value: string | undefined): "test" | "production" | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === "test" || normalized === "testing") {
    return "test";
  }

  if (normalized === "production" || normalized === "prod") {
    return "production";
  }

  return null;
}

function getDatabaseName(databaseUrl: string | undefined): string | null {
  if (!databaseUrl?.trim()) {
    return null;
  }

  try {
    const parsed = new URL(databaseUrl);
    return parsed.pathname.replace(/^\//, "").trim() || null;
  } catch {
    return null;
  }
}

function isEnabled(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}
