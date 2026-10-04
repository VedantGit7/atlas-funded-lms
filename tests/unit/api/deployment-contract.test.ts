import { describe, expect, it } from "vitest";
import { validateDeploymentConfiguration } from "@atlas/core/config/deployment-contract";
import { deploymentEnv } from "../../helpers/deployment-env";

describe("F05 deployment contract", () => {
  it.each(["", "0"])(
    "rejects deployed web with TRUSTED_PROXY_HOPS=%s and no edge header",
    (hops) => {
      expect(() =>
        validateDeploymentConfiguration(
          { ...deploymentEnv(), TRUSTED_PROXY_HOPS: hops, TRUSTED_CLIENT_IP_HEADER: "" },
          "web",
        ),
      ).toThrow(/client-IP attribution/);
    },
  );
  it.each(["api", "worker"] as const)(
    "does not require edge attribution settings on %s",
    (service) => {
      expect(() =>
        validateDeploymentConfiguration(
          { ...deploymentEnv(), TRUSTED_PROXY_HOPS: "0", TRUSTED_CLIENT_IP_HEADER: "" },
          service,
        ),
      ).not.toThrow();
    },
  );
  it("accepts an explicitly configured single-value web edge header at zero hops", () => {
    expect(() =>
      validateDeploymentConfiguration(
        {
          ...deploymentEnv(),
          TRUSTED_PROXY_HOPS: "0",
          TRUSTED_CLIENT_IP_HEADER: "cf-connecting-ip",
        },
        "web",
      ),
    ).not.toThrow();
  });
  it.each(["x-atlas-client-ip", "invalid header"])(
    "rejects unsafe deployed web edge header %s",
    (header) => {
      expect(() =>
        validateDeploymentConfiguration(
          { ...deploymentEnv(), TRUSTED_CLIENT_IP_HEADER: header },
          "web",
        ),
      ).toThrow(/TRUSTED_CLIENT_IP_HEADER/);
    },
  );
  it("does not let a development label enable API execution on Lambda", () => {
    expect(() =>
      validateDeploymentConfiguration(
        { NODE_ENV: "test", APP_ENV: "test", AWS_LAMBDA_FUNCTION_NAME: "handler" },
        "api",
      ),
    ).toThrow(/serverless\/edge/);
  });
  it.each(["api", "worker"] as const)("requires managed Node ownership for %s", (service) => {
    expect(() =>
      validateDeploymentConfiguration({ ...deploymentEnv(), ATLAS_SERVICE_RUNTIME: "" }, service),
    ).toThrow(/ATLAS_SERVICE_RUNTIME/);
    for (const marker of [
      { VERCEL: "1" },
      { VERCEL_ENV: "preview" },
      { AWS_LAMBDA_FUNCTION_NAME: "function" },
      { LAMBDA_TASK_ROOT: "/var/task" },
      { NETLIFY: "true" },
      { FUNCTIONS_WORKER_RUNTIME: "node" },
      { FUNCTION_TARGET: "handler" },
      { NEXT_RUNTIME: "edge" },
    ]) {
      expect(() =>
        validateDeploymentConfiguration({ ...deploymentEnv(), ...marker }, service),
      ).toThrow(/serverless\/edge/);
    }
  });
  it("keeps the web deployable on Vercel", () => {
    expect(() =>
      validateDeploymentConfiguration(
        { ...deploymentEnv(), VERCEL: "1", ATLAS_SERVICE_RUNTIME: "" },
        "web",
      ),
    ).not.toThrow();
  });
  it.each(["api", "web"] as const)(
    "requires a dedicated proxy secret for deployed %s",
    (service) => {
      for (const key of [
        "",
        "short",
        deploymentEnv().CRON_SECRET,
        deploymentEnv().INTERNAL_WORKER_SECRET,
      ]) {
        expect(() =>
          validateDeploymentConfiguration({ ...deploymentEnv(), API_PROXY_SECRET: key }, service),
        ).toThrow(/API_PROXY_SECRET/);
      }
    },
  );
  it("requires valid SCORM content signing keys on the API, distinct from other secrets", () => {
    const env = deploymentEnv();
    for (const keys of [
      "",
      "no-separator",
      "k1:short",
      `k1:${env.API_PROXY_SECRET ?? ""}`,
      `k1:${env.CRON_SECRET ?? ""}`,
    ]) {
      expect(() =>
        validateDeploymentConfiguration({ ...env, SCORM_CONTENT_SIGNING_KEYS: keys }, "api"),
      ).toThrow(/SCORM_CONTENT_SIGNING_KEYS/);
    }
    expect(() =>
      validateDeploymentConfiguration(
        {
          ...env,
          SCORM_CONTENT_SIGNING_KEYS: `${env.SCORM_CONTENT_SIGNING_KEYS ?? ""},old:${"e".repeat(20)}f${"0".repeat(20)}`,
        },
        "api",
      ),
    ).not.toThrow();
  });
  it.each(["web", "worker"] as const)(
    "does not require SCORM signing keys on the %s",
    (service) => {
      expect(() =>
        validateDeploymentConfiguration(
          { ...deploymentEnv(), SCORM_CONTENT_SIGNING_KEYS: "" },
          service,
        ),
      ).not.toThrow();
    },
  );
  it("requires an enforced CSP on deployed web (audit H5)", () => {
    for (const value of ["", "0"]) {
      expect(() =>
        validateDeploymentConfiguration({ ...deploymentEnv(), CSP_ENFORCE: value }, "web"),
      ).toThrow(/CSP_ENFORCE must be 1/);
    }
    expect(() => validateDeploymentConfiguration(deploymentEnv(), "web")).not.toThrow();
  });
  it("allows report-only on web only as a recorded incident rollback", () => {
    const rollback = { ...deploymentEnv(), CSP_ENFORCE: "0" };
    expect(() =>
      validateDeploymentConfiguration(
        { ...rollback, CSP_REPORT_ONLY_INCIDENT: "INC-2026-0142" },
        "web",
      ),
    ).not.toThrow();
    for (const incident of ["x", "no spaces allowed", "<script>"]) {
      expect(() =>
        validateDeploymentConfiguration({ ...rollback, CSP_REPORT_ONLY_INCIDENT: incident }, "web"),
      ).toThrow(/CSP_ENFORCE must be 1/);
    }
  });
  it.each(["api", "worker"] as const)(
    "does not require browser CSP settings on the %s",
    (service) => {
      expect(() =>
        validateDeploymentConfiguration({ ...deploymentEnv(), CSP_ENFORCE: "" }, service),
      ).not.toThrow();
    },
  );
  it.each(["api", "web"] as const)(
    "refuses to deploy %s with the breached-password check off (audit H6)",
    (service) => {
      for (const mode of ["off", "OFF", " off "]) {
        expect(() =>
          validateDeploymentConfiguration(
            { ...deploymentEnv(), PASSWORD_BREACH_CHECK: mode },
            service,
          ),
        ).toThrow(/PASSWORD_BREACH_CHECK/);
      }
      for (const mode of ["", "enforce"]) {
        expect(() =>
          validateDeploymentConfiguration(
            { ...deploymentEnv(), PASSWORD_BREACH_CHECK: mode },
            service,
          ),
        ).not.toThrow();
      }
    },
  );
  it("does not require the web/API forwarding secret on the worker", () => {
    expect(() =>
      validateDeploymentConfiguration({ ...deploymentEnv(), API_PROXY_SECRET: "" }, "worker"),
    ).not.toThrow();
  });
  it("rejects whitespace in feature flags rather than skipping signing requirements", () => {
    expect(() =>
      validateDeploymentConfiguration({ ...deploymentEnv(), CERTIFICATE_OPEN_BADGE: "false " }),
    ).toThrow(/CERTIFICATE_OPEN_BADGE/);
  });
  it.each([
    "user=postgres",
    "sslmode=disable",
    "uselibpqcompat=false&uselibpqcompat=true",
    "options=-c%20role%3Dpostgres",
  ])("rejects driver overrides %s", (query) => {
    const env = deploymentEnv();
    env.DATABASE_URL += `&${query}`;
    expect(() => validateDeploymentConfiguration(env)).toThrow(/connection parameters/);
  });
  it.each(["", "developmnt", "test", "development"])("rejects deployed APP_ENV=%s", (APP_ENV) => {
    expect(() => validateDeploymentConfiguration({ ...deploymentEnv(), APP_ENV })).toThrow(
      /APP_ENV/,
    );
  });
  it("requires explicit environment in a hosted preview", () => {
    expect(() =>
      validateDeploymentConfiguration({
        VERCEL: "1",
        VERCEL_ENV: "preview",
        APP_ENV: "test",
        NODE_ENV: "test",
      }),
    ).toThrow(/APP_ENV/);
  });
  it("allows intentional local test mode only without deployed signals", () => {
    expect(validateDeploymentConfiguration({ APP_ENV: "test", NODE_ENV: "test" })).toMatchObject({
      deployed: false,
      environment: "test",
    });
  });
  it.each([
    ["STORAGE_PROVIDER", "local-fs"],
    ["STORAGE_LOCAL_SIGNING_SECRET", "atlas-local-storage-dev-secret"],
    ["APP_URL", "http://learn.example.test"],
    ["APP_URL", "https://learn.example.test/path"],
    ["APP_URL", "https://secret:private@example.test"],
    ["PLATFORM_HOST", "platform.localhost"],
    ["API_INTERNAL_URL", "http://api.example.test"],
    ["CRON_SECRET", "short"],
    ["LEARNER_BILLING_ENC_KEY", "not-base64"],
    ["SMTP_PORT", "587oops"],
    ["SENTRY_DSN", "not-a-dsn"],
    ["SENTRY_TRACES_SAMPLE_RATE", "NaN"],
    ["OUTBOX_WORKER_INTERVAL_MS", "1.5"],
    ["NOTIFICATION_EMAIL_FROM", "bad\r\nBcc: attacker@example.test"],
  ])("rejects unsafe %s", (key, value) => {
    expect(() => validateDeploymentConfiguration({ ...deploymentEnv(), [key]: value })).toThrow(
      new RegExp(key),
    );
  });
  it("rejects the same database role even when URLs differ", () => {
    const env = deploymentEnv();
    env.PLATFORM_DATABASE_URL =
      "postgresql://atlas_app_login:other-password@other.example.test/atlas";
    expect(() => validateDeploymentConfiguration(env)).toThrow(/separate database roles/);
  });
  it.each(["postgres", "atlas", "supabase_admin"])(
    "rejects privileged database login %s",
    (login) => {
      expect(() =>
        validateDeploymentConfiguration({
          ...deploymentEnv(),
          DATABASE_URL: `postgresql://${login}:private@db.example.test/atlas`,
        }),
      ).toThrow(/dedicated runtime login/);
    },
  );
  it("rejects a server secret in the public Supabase slot", () => {
    expect(() =>
      validateDeploymentConfiguration({
        ...deploymentEnv(),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_secret_not-public",
      }),
    ).toThrow(/public key/);
  });
  it("rejects privileged legacy keys even after server key rotation", () => {
    const key = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.synthetic`;
    expect(() =>
      validateDeploymentConfiguration({ ...deploymentEnv(), NEXT_PUBLIC_SUPABASE_ANON_KEY: key }),
    ).toThrow(/privileged JWT/);
  });
  it("rejects missing database TLS", () => {
    expect(() =>
      validateDeploymentConfiguration({
        ...deploymentEnv(),
        DATABASE_URL: "postgresql://atlas_app_login:synthetic@db.example.test/atlas",
      }),
    ).toThrow(/TLS/);
  });
  it("requires valid signing material when Open Badge is enabled", () => {
    expect(() =>
      validateDeploymentConfiguration({
        ...deploymentEnv(),
        CERTIFICATE_OPEN_BADGE: "true",
        CERTIFICATE_ISSUER_PRIVATE_KEY: "bad-pem",
      }),
    ).toThrow(/CERTIFICATE_ISSUER_PRIVATE_KEY/);
  });
  it("never echoes malformed secrets or connection URLs", () => {
    const secret = "sensitive-user:do-not-log-this";
    try {
      validateDeploymentConfiguration({
        ...deploymentEnv(),
        DATABASE_URL: `garbage://${secret}`,
        CRON_SECRET: "private",
      });
      throw new Error("accepted");
    } catch (error) {
      expect(String(error)).toContain("DATABASE_URL");
      expect(String(error)).not.toContain(secret);
      expect(String(error)).not.toContain("private");
    }
  });
});
