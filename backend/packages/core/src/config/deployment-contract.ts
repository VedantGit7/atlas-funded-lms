import { createPrivateKey } from "node:crypto";
import { validateClientIpConfiguration } from "../http/client-ip";
import {
  isDeployedRuntime,
  resolveRuntimeEnvironment,
  type RuntimeEnvironment,
} from "./runtime-environment";
import {
  parseScormContentSigningKeys,
  SCORM_CONTENT_SIGNING_KEYS_ENV,
  ScormContentSigningKeysError,
} from "./scorm-content-keys";

export type DeploymentService = "api" | "web" | "worker";

export class DeploymentConfigurationError extends Error {
  readonly issues: readonly string[];
  constructor(issues: string[]) {
    super(`Invalid deployment configuration: ${issues.join("; ")}`);
    this.name = "DeploymentConfigurationError";
    this.issues = issues;
  }
}

/** Pure and value-redacted: validates configuration, never provider connectivity. */
export function validateDeploymentConfiguration(
  env: NodeJS.ProcessEnv = process.env,
  service: DeploymentService = "api",
): { environment: RuntimeEnvironment; deployed: boolean; service: DeploymentService } {
  const issues: string[] = [];
  let environment: RuntimeEnvironment;
  try {
    environment = resolveRuntimeEnvironment(env);
  } catch {
    throw new DeploymentConfigurationError([
      "APP_ENV must explicitly match a supported deployment environment",
    ]);
  }
  const deployed = isDeployedRuntime(env);
  const value = (key: string) => env[key]?.trim() ?? "";
  if (service !== "web") {
    if (
      value("VERCEL") === "1" ||
      ["production", "preview"].includes(value("VERCEL_ENV")) ||
      value("AWS_LAMBDA_FUNCTION_NAME") ||
      value("LAMBDA_TASK_ROOT") ||
      value("NETLIFY") === "true" ||
      value("FUNCTIONS_WORKER_RUNTIME") ||
      value("FUNCTION_TARGET") ||
      value("NEXT_RUNTIME") === "edge"
    )
      throw new DeploymentConfigurationError([
        "API and worker require a long-lived managed Node service; serverless/edge runtimes are unsupported",
      ]);
  }
  if (!deployed) return { environment, deployed, service };
  // Both services set passwords: the API for signup, change and invitations,
  // the web for password reset. Only the test runtime may skip the breached-
  // password lookup (audit H6); it already fails open if the service is down.
  if (service !== "worker" && value("PASSWORD_BREACH_CHECK").toLowerCase() === "off")
    issues.push("PASSWORD_BREACH_CHECK must not be off in deployed API and web services");
  if (service === "web") {
    // Report-only CSP is not XSS prevention, and tenant snippets run on this
    // origin (audit H5). Deployed web enforces unless an incident explicitly
    // records the emergency rollback described in the CSP runbook.
    if (
      value("CSP_ENFORCE") !== "1" &&
      !/^[A-Za-z0-9][A-Za-z0-9_.:/-]{2,63}$/.test(value("CSP_REPORT_ONLY_INCIDENT"))
    )
      issues.push(
        "CSP_ENFORCE must be 1 in deployed web; report-only requires CSP_REPORT_ONLY_INCIDENT naming the incident",
      );
    try {
      validateClientIpConfiguration(env);
      if (!value("TRUSTED_CLIENT_IP_HEADER") && Number(value("TRUSTED_PROXY_HOPS")) === 0) {
        issues.push(
          "Web client-IP attribution requires explicit TRUSTED_PROXY_HOPS > 0 or TRUSTED_CLIENT_IP_HEADER",
        );
      }
    } catch {
      issues.push("TRUSTED_PROXY_HOPS / TRUSTED_CLIENT_IP_HEADER configuration is invalid");
    }
  }
  if (service !== "web" && value("ATLAS_SERVICE_RUNTIME") !== "managed-node")
    issues.push("ATLAS_SERVICE_RUNTIME must be managed-node for deployed API and worker services");
  for (const key of [
    "CERTIFICATE_OPEN_BADGE",
    "CERTIFICATE_WALLETS",
    "CERTIFICATE_BLOCKCHAIN_ANCHOR",
    "CERTIFICATE_PDF_WORKER",
  ]) {
    const raw = env[key];
    if (raw && raw !== "true" && raw !== "false")
      issues.push(`${key} must be exactly true or false when configured`);
  }
  const requireValue = (key: string) => {
    const result = value(key);
    if (!result) issues.push(`${key} is required`);
    return result;
  };
  const secret = (key: string, min = 32) => {
    const result = requireValue(key);
    if (
      result &&
      (result.length < min ||
        /^(.)\1+$/.test(result) ||
        /^(changeme|change-me|replace-me|example|password|atlas-local-storage-dev-secret)$/i.test(
          result,
        ))
    ) {
      issues.push(`${key} must be a strong non-development secret (at least ${min} characters)`);
    }
  };
  const url = (key: string, protocols = ["https:"], originOnly = false): URL | null => {
    const raw = requireValue(key);
    if (!raw) return null;
    try {
      const parsed = new URL(raw);
      if (
        !protocols.includes(parsed.protocol) ||
        !parsed.hostname ||
        parsed.username ||
        parsed.password ||
        parsed.hash ||
        (originOnly && (parsed.pathname !== "/" || parsed.search))
      )
        throw new Error();
      if (
        protocols.length === 1 &&
        protocols[0] === "https:" &&
        /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(parsed.hostname)
      )
        throw new Error();
      return parsed;
    } catch {
      issues.push(
        `${key} must be a valid ${originOnly ? "origin" : "URL"} with the required transport`,
      );
      return null;
    }
  };
  const integer = (key: string, fallback: number, max = Number.MAX_SAFE_INTEGER) => {
    const raw = value(key) || String(fallback);
    const parsed = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(parsed) || parsed < 1 || parsed > max)
      issues.push(`${key} must be a positive integer within its supported range`);
  };

  if (value("STORAGE_PROVIDER") !== "r2")
    issues.push("STORAGE_PROVIDER must be r2 for persistent deployed storage");
  for (const key of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"])
    requireValue(key);
  if (value("STORAGE_LOCAL_SIGNING_SECRET") === "atlas-local-storage-dev-secret")
    issues.push("STORAGE_LOCAL_SIGNING_SECRET must not contain the development default");
  if (value("R2_PUBLIC_ENDPOINT")) url("R2_PUBLIC_ENDPOINT");

  const database = (key: string): string | null => {
    const raw = requireValue(key);
    if (!raw) return null;
    try {
      const parsed = new URL(raw);
      const login = decodeURIComponent(parsed.username);
      const seenParameters = new Set<string>();
      const allowedParameters = new Set([
        "sslmode",
        "schema",
        "pgbouncer",
        "connection_limit",
        "pool_timeout",
      ]);
      for (const parameter of parsed.searchParams.keys()) {
        if (seenParameters.has(parameter) || !allowedParameters.has(parameter)) {
          issues.push(`${key} contains duplicate or unsupported connection parameters`);
          break;
        }
        seenParameters.add(parameter);
      }
      const role = login.split(".")[0] ?? ""; // Supabase pooler logins may suffix the project ref.
      if (
        !["postgres:", "postgresql:"].includes(parsed.protocol) ||
        !parsed.hostname ||
        !login ||
        !parsed.password ||
        parsed.pathname.length < 2 ||
        parsed.hash
      )
        throw new Error();
      if (
        ["postgres", "atlas", "atlas_app", "atlas_platform", "supabase_admin"].includes(
          role.toLowerCase(),
        )
      )
        issues.push(`${key} must use a dedicated runtime login, not an owner or group role`);
      if (
        !["require", "verify-ca", "verify-full"].includes(
          parsed.searchParams.get("sslmode") ?? "",
        ) ||
        parsed.searchParams.get("uselibpqcompat") === "true"
      )
        issues.push(`${key} must explicitly require verified database TLS`);
      return login;
    } catch {
      issues.push(`${key} must be a PostgreSQL URL with an explicit runtime login and database`);
      return null;
    }
  };
  const appLogin = database("DATABASE_URL");
  const platformLogin = database("PLATFORM_DATABASE_URL");
  if (appLogin && platformLogin && appLogin === platformLogin)
    issues.push("DATABASE_URL and PLATFORM_DATABASE_URL must use separate database roles");
  integer("DATABASE_POOL_MAX", 20, 1000);
  integer("PLATFORM_DATABASE_POOL_MAX", 10, 1000);

  url("APP_URL", ["https:"], true);
  const host = requireValue("PLATFORM_HOST");
  if (
    host &&
    (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(host) ||
      !host.includes(".") ||
      /(^|\.)localhost(\.|$)/i.test(host))
  )
    issues.push("PLATFORM_HOST must be a canonical deployed hostname without scheme, port or path");
  // HTTP is allowed only for explicitly configured private/internal transports.
  const internal = url("API_INTERNAL_URL", ["http:", "https:"], true);
  if (
    internal?.protocol === "http:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(internal.hostname) &&
    !internal.hostname.endsWith(".internal")
  )
    issues.push("API_INTERNAL_URL must use HTTPS outside an explicit local/private transport");
  for (const key of ["PUBLIC_SITE_URL", "CERTIFICATE_PUBLIC_BASE_URL"])
    if (value(key)) url(key, ["https:"], true);
  url("NEXT_PUBLIC_SUPABASE_URL", ["https:"], true);
  requireValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  requireValue("SUPABASE_SERVICE_ROLE_KEY");
  if (
    value("NEXT_PUBLIC_SUPABASE_ANON_KEY") &&
    value("NEXT_PUBLIC_SUPABASE_ANON_KEY") === value("SUPABASE_SERVICE_ROLE_KEY")
  )
    issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY must not expose the service-role key");
  if (value("NEXT_PUBLIC_SUPABASE_ANON_KEY").startsWith("sb_secret_"))
    issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY must be a public key");
  const publicKey = value("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (publicKey && !publicKey.startsWith("sb_publishable_")) {
    try {
      const segments = publicKey.split(".");
      if (segments.length !== 3 || !segments[1]) throw new Error();
      const payload: unknown = JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8"));
      if (
        !payload ||
        typeof payload !== "object" ||
        !("role" in payload) ||
        payload.role !== "anon"
      )
        throw new Error();
    } catch {
      issues.push(
        "NEXT_PUBLIC_SUPABASE_ANON_KEY must be a publishable key or legacy anon key, never a privileged JWT",
      );
    }
  }
  if (
    value("SUPABASE_URL") &&
    value("SUPABASE_URL").replace(/\/$/, "") !==
      value("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "")
  )
    issues.push("SUPABASE_URL must match NEXT_PUBLIC_SUPABASE_URL when both are configured");

  for (const key of ["CRON_SECRET", "INTERNAL_WORKER_SECRET", "OBSERVABILITY_HASH_SALT"])
    secret(key);
  if (service !== "worker") {
    secret("API_PROXY_SECRET");
    if ([value("CRON_SECRET"), value("INTERNAL_WORKER_SECRET")].includes(value("API_PROXY_SECRET")))
      issues.push("API_PROXY_SECRET must be distinct from cron and worker secrets");
  }
  if (service === "api") {
    // The API mints and verifies SCORM package-read capabilities; web only forwards them.
    const raw = requireValue(SCORM_CONTENT_SIGNING_KEYS_ENV);
    if (raw) {
      try {
        const otherSecrets = new Set(
          ["CRON_SECRET", "INTERNAL_WORKER_SECRET", "API_PROXY_SECRET", "OBSERVABILITY_HASH_SALT"]
            .map(value)
            .filter(Boolean),
        );
        if (parseScormContentSigningKeys(raw).some((key) => otherSecrets.has(key.secret)))
          issues.push(
            `${SCORM_CONTENT_SIGNING_KEYS_ENV} secrets must be distinct from every other service secret`,
          );
      } catch (error) {
        issues.push(
          error instanceof ScormContentSigningKeysError
            ? error.message
            : `${SCORM_CONTENT_SIGNING_KEYS_ENV} is invalid`,
        );
      }
    }
  }
  const billingKey = requireValue("LEARNER_BILLING_ENC_KEY");
  if (
    billingKey &&
    (!/^[A-Za-z0-9+/]{43}=$/.test(billingKey) || Buffer.from(billingKey, "base64").length !== 32)
  )
    issues.push("LEARNER_BILLING_ENC_KEY must be a base64-encoded 32-byte key");
  if (value("CRON_SECRET") && value("CRON_SECRET") === value("INTERNAL_WORKER_SECRET"))
    issues.push("CRON_SECRET and INTERNAL_WORKER_SECRET must be distinct");

  if (value("NOTIFICATION_EMAIL_PROVIDER").toLowerCase() !== "smtp")
    issues.push("NOTIFICATION_EMAIL_PROVIDER must be smtp in deployed runtimes");
  const smtpHost = requireValue("SMTP_HOST");
  if (smtpHost && (!/^[a-z0-9.-]+$/i.test(smtpHost) || smtpHost.includes("..")))
    issues.push("SMTP_HOST must be a hostname without URL components");
  integer("SMTP_PORT", 587, 65535);
  requireValue("SMTP_USER");
  requireValue("SMTP_PASSWORD");
  const sender = requireValue("NOTIFICATION_EMAIL_FROM");
  if (
    sender &&
    (/[\r\n]/.test(sender) ||
      // Domain labels exclude "." so the pattern cannot backtrack (CodeQL js/polynomial-redos).
      !/^(?:[^<>]+<)?[^<>\s@]+@[^<>\s@.]+(?:\.[^<>\s@.]+)+>?$/.test(sender))
  )
    issues.push("NOTIFICATION_EMAIL_FROM must be a valid sender mailbox");

  const dsnKey = value("NEXT_PUBLIC_SENTRY_DSN") ? "NEXT_PUBLIC_SENTRY_DSN" : "SENTRY_DSN";
  const dsn = requireValue(dsnKey);
  if (dsn) {
    try {
      const parsed = new URL(dsn);
      if (
        parsed.protocol !== "https:" ||
        !parsed.username ||
        parsed.password ||
        parsed.pathname.length < 2 ||
        parsed.hash ||
        parsed.search
      )
        throw new Error();
    } catch {
      issues.push(`${dsnKey} must be a valid HTTPS Sentry DSN`);
    }
  }
  if (!value("RELEASE_SHA") && !value("RELEASE_VERSION"))
    issues.push("RELEASE_SHA or RELEASE_VERSION is required");
  const sample = value("SENTRY_TRACES_SAMPLE_RATE");
  if (sample && (!Number.isFinite(Number(sample)) || Number(sample) < 0 || Number(sample) > 1))
    issues.push("SENTRY_TRACES_SAMPLE_RATE must be between zero and one");
  url("BETTER_STACK_WORKER_HEARTBEAT_URL");
  for (const [key, fallback] of [
    ["OUTBOX_WORKER_INTERVAL_MS", 5000],
    ["OUTBOX_WORKER_BATCH_LIMIT", 25],
    ["OUTBOX_WORKER_MAX_RETRIES", 3],
    ["OUTBOX_WORKER_HEALTH_PORT", 8081],
    ["OUTBOX_WORKER_SHUTDOWN_TIMEOUT_MS", 30000],
  ] as const)
    integer(
      key,
      fallback,
      key.endsWith("PORT") ? 65535 : key.endsWith("BATCH_LIMIT") ? 100 : Number.MAX_SAFE_INTEGER,
    );

  if (value("CERTIFICATE_OPEN_BADGE") !== "false") {
    const pem = requireValue("CERTIFICATE_ISSUER_PRIVATE_KEY");
    requireValue("CERTIFICATE_ISSUER_DID");
    url("CERTIFICATE_PUBLIC_BASE_URL", ["https:"], true);
    if (pem) {
      try {
        if (createPrivateKey(pem).asymmetricKeyType !== "ed25519") throw new Error();
      } catch {
        issues.push("CERTIFICATE_ISSUER_PRIVATE_KEY must be a valid Ed25519 private key");
      }
    }
  }
  if (issues.length) throw new DeploymentConfigurationError(issues);
  return { environment, deployed, service };
}
