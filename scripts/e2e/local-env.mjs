import { createHmac } from "node:crypto";
import { resolve } from "node:path";

// Public, disposable Docker fixture credentials. Never used for hosted services.
const secret = "atlas-f16-local-auth-secret-only-32-characters";
function jwt(role) {
  const enc = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const body = `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ role, iss: "supabase", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 })}`;
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}
export const ownerUrl = "postgres://atlas:atlas_e2e_only_password@127.0.0.1:15436/atlas_lms_e2e";
export function localEnv() {
  return {
    DATABASE_URL: ownerUrl,
    DIRECT_DATABASE_URL: ownerUrl,
    PLATFORM_DATABASE_URL: ownerUrl,
    E2E_OWNER_DATABASE_URL: ownerUrl,
    SUPABASE_URL: "http://127.0.0.1:54326",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54326",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("anon"),
    SUPABASE_ANON_KEY: jwt("anon"),
    SUPABASE_SERVICE_ROLE_KEY: jwt("service_role"),
    SUPABASE_JWT_SECRET: secret,
    E2E_SEED_PASSWORD: "Atlas-e2e-disposable-Password-1",
    E2E_TENANT_SLUG: "fundedbeyond",
    TENANT_BASE_DOMAIN: "localhost",
    E2E_TENANT_BASE_URL: "http://fundedbeyond.localhost:3100",
    E2E_SECOND_TENANT_BASE_URL: "http://second-smoke-academy.localhost:3100",
    E2E_PLATFORM_BASE_URL: "http://platform.localhost:3100",
    API_INTERNAL_URL: "http://127.0.0.1:3101",
    PLATFORM_HOST: "platform.localhost",
    E2E_REQUIRE_AUTH_JOURNEYS: "1",
    BROWSER_E2E_DEV: "1",
    BROWSER_E2E: "0",
    E2E_SCENARIO_PATH: resolve(".test-results/f16/scenario.json"),
    E2E_CREDENTIALS_PATH: resolve(".test-results/f16/credentials.env"),
    ATLAS_APP_LOGIN_PASSWORD: "atlas_e2e_app_only",
    ATLAS_PLATFORM_LOGIN_PASSWORD: "atlas_e2e_platform_only",
    STORAGE_PROVIDER: "local-fs",
    NODE_ENV: "development",
    NEXT_TELEMETRY_DISABLED: "1",
  };
}
