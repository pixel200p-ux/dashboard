import assert from "node:assert/strict";
import test from "node:test";
import { isDatabaseConfiguredForRuntime, resolveDatabaseUrl } from "./db-config.mjs";

test("local dev falls back to PGLite when auth is disabled and a stale remote DATABASE_URL is present", () => {
  const env = {
    NODE_ENV: "development",
    VITE_AUTH_ENABLED: "false",
    DATABASE_URL: "postgres://user:pass@52.77.146.31:6543/app",
  };

  assert.equal(resolveDatabaseUrl(env), undefined);
  assert.equal(isDatabaseConfiguredForRuntime(env), false);
});

test("explicit opt-in keeps a remote DATABASE_URL in local dev", () => {
  const env = {
    NODE_ENV: "development",
    VITE_AUTH_ENABLED: "false",
    ALLOW_REMOTE_DB: "true",
    DATABASE_URL: "postgres://user:pass@localhost:5432/app",
  };

  assert.equal(resolveDatabaseUrl(env), env.DATABASE_URL);
  assert.equal(isDatabaseConfiguredForRuntime(env), true);
});
