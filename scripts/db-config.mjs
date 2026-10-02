export function resolveDatabaseUrl(env = process.env) {
  const rawDatabaseUrl = env.DATABASE_URL?.trim();
  if (!rawDatabaseUrl) return undefined;

  const localDevFallback =
    env.NODE_ENV !== "production" &&
    env.VITE_AUTH_ENABLED === "false" &&
    env.ALLOW_REMOTE_DB !== "true";

  return localDevFallback ? undefined : rawDatabaseUrl;
}

export function isDatabaseConfiguredForRuntime(env = process.env) {
  return Boolean(resolveDatabaseUrl(env));
}
