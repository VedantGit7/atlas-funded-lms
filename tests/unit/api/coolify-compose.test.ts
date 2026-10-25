import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { validateDeploymentStartup } from "../../../backend/packages/api/src/deployment-startup";
import { deploymentEnv } from "../../helpers/deployment-env";

/**
 * deploy/coolify/compose.yaml is the production topology. Coolify passes a
 * setting to a container only when the service lists it, so a missing entry
 * is a container that answers 500 from its first request. These checks run the
 * real startup validation against what the file would give each service.
 */
const root = resolve(import.meta.dirname, "../../..");
const compose = parse(readFileSync(join(root, "deploy/coolify/compose.yaml"), "utf8")) as {
  services: Record<string, Service>;
  networks?: unknown;
};
const reference = parse(readFileSync(join(root, "deploy/managed-node/compose.yaml"), "utf8")) as {
  services: Record<string, Service>;
};

type Service = {
  image: string;
  links?: string[];
  ports?: unknown;
  networks?: unknown;
  environment: Record<string, string>;
  healthcheck: { test: string[] };
  [key: string]: unknown;
};
type DeploymentService = "api" | "web" | "worker";

const services: DeploymentService[] = ["web", "api", "worker"];
// A complete staging configuration (synthetic values; nothing connects).
const settings: NodeJS.ProcessEnv = { ...deploymentEnv(), APP_ENV: "staging" };

const VARIABLE = /\$\{([A-Z0-9_]+)(:\?|:-([^}]*))?\}/g;

function serviceIn(file: { services: Record<string, Service> }, name: string): Service {
  const found = file.services[name];
  if (!found) throw new Error(`no ${name} service`);
  return found;
}
const coolify = (name: string) => serviceIn(compose, name);
const managed = (name: string) => serviceIn(reference, name);

/** What Coolify would give the container: literals, set values or defaults. */
function resolveEnvironment(
  service: DeploymentService,
  available: NodeJS.ProcessEnv = settings,
): NodeJS.ProcessEnv {
  const resolved: NodeJS.ProcessEnv = {};
  for (const [key, raw] of Object.entries(coolify(service).environment)) {
    resolved[key] = String(raw).replace(
      VARIABLE,
      (_match, name: string, modifier: string | undefined, fallback: string | undefined) => {
        const value = available[name];
        if (value !== undefined && value !== "") return value;
        if (modifier?.startsWith(":-")) return fallback ?? "";
        throw new Error(`${service}.${key} needs ${name}, which the test settings lack`);
      },
    );
  }
  // The images set these; Coolify does not.
  return { ...resolved, NODE_ENV: "production", NEXT_RUNTIME: "nodejs" };
}

describe("Coolify compose topology", () => {
  it.each(services)("gives %s everything its startup validation requires", (service) => {
    expect(() => validateDeploymentStartup(service, resolveEnvironment(service))).not.toThrow();
  });

  it.each(services)("never hands %s an empty setting", (service) => {
    // Coolify passes an unset ${NAME} as an empty string, which some parsers
    // reject. Every reference is either required (${NAME:?}, so Coolify refuses
    // to deploy without it) or has a default (${NAME:-value}).
    for (const [key, raw] of Object.entries(coolify(service).environment))
      for (const match of String(raw).matchAll(VARIABLE)) expect(match[2], key).toBeDefined();
  });

  it.each(services)("starts %s on the defaults when the optional settings are unset", (service) => {
    const optional = new Set<string>();
    for (const raw of Object.values(coolify(service).environment))
      for (const match of String(raw).matchAll(VARIABLE))
        if (match[2]?.startsWith(":-")) optional.add(String(match[1]));
    const unset = Object.fromEntries(
      Object.entries(settings).filter(([name]) => !optional.has(name)),
    );
    expect(optional.size).toBeGreaterThan(0);
    expect(() =>
      validateDeploymentStartup(service, resolveEnvironment(service, unset)),
    ).not.toThrow();
  });

  it("keeps each service's credentials to what it uses", () => {
    const env = (service: DeploymentService) => Object.keys(coolify(service).environment);
    // The worker never proxies to the API; only the API signs SCORM reads.
    expect(env("worker")).not.toContain("API_PROXY_SECRET");
    expect(env("worker")).not.toContain("SCORM_CONTENT_SIGNING_KEYS");
    expect(env("web")).not.toContain("SCORM_CONTENT_SIGNING_KEYS");
    // Migration and owner logins never reach a runtime container.
    for (const service of services)
      for (const key of ["DIRECT_DATABASE_URL", "MIGRATION_DATABASE_URL", "PRISMA_MIGRATION_URL"])
        expect(env(service)).not.toContain(key);
  });

  it("deploys one commit's images and reports that commit", () => {
    expect(coolify("web").image).toBe("ghcr.io/vedantgit7/atlas-web:${APP_ENV:?}-${RELEASE_SHA:?}");
    expect(coolify("api").image).toBe("ghcr.io/vedantgit7/atlas-api:${APP_ENV:?}-${RELEASE_SHA:?}");
    expect(coolify("worker").image).toBe("ghcr.io/vedantgit7/atlas-worker:${RELEASE_SHA:?}");
    for (const service of services) {
      expect(coolify(service).environment.RELEASE_SHA).toBe("${RELEASE_SHA:?}");
      expect(coolify(service).environment.RELEASE_ENV).toBe("${APP_ENV:?}");
    }
  });

  it("reaches the API privately under a name the contract allows, on Coolify's network only", () => {
    // A second network makes Traefik's routing unreliable (Coolify docs).
    expect(compose.networks).toBeUndefined();
    for (const service of services) {
      expect(coolify(service).networks).toBeUndefined();
      expect(coolify(service).ports).toBeUndefined();
      expect(coolify(service).environment.API_INTERNAL_URL).toBe("http://api.atlas.internal:3001");
    }
    expect(coolify("web").links).toEqual(["api:api.atlas.internal"]);
  });

  it("hardens every service like the reference deployment", () => {
    const keys = [
      "init",
      "restart",
      "stop_grace_period",
      "mem_limit",
      "cpus",
      "read_only",
      "tmpfs",
    ];
    for (const service of services)
      for (const key of keys)
        expect(coolify(service)[key], `${service}.${key}`).toEqual(
          managed(service === "web" ? "api" : service)[key],
        );
    expect(coolify("worker").shm_size).toBe(managed("worker").shm_size);
    expect(coolify("worker").healthcheck).toEqual(managed("worker").healthcheck);
  });

  it.each(services)(
    "turns marketing email off on %s unless the variable says otherwise",
    (service) => {
      // The SMTP agent is ZeptoMail, which allows only transactional mail (launch plan 1.6).
      expect(coolify(service).environment.MARKETING_EMAIL_ENABLED).toBe(
        "${MARKETING_EMAIL_ENABLED:-false}",
      );
      expect(resolveEnvironment(service).MARKETING_EMAIL_ENABLED).toBe("false");
      expect(() =>
        validateDeploymentStartup(
          service,
          resolveEnvironment(service, { ...settings, SMTP_HOST: "smtp.zeptomail.in" }),
        ),
      ).not.toThrow();
    },
  );

  it.each(services)("trusts Coolify's CA for %s's database TLS", (service) => {
    // pg treats sslmode=require as verify-full, and the contract forbids
    // sslrootcert, so the CA that signs Coolify's PostgreSQL certificate has to
    // reach Node through NODE_EXTRA_CA_CERTS, mounted read-only.
    const path = coolify(service).environment.NODE_EXTRA_CA_CERTS;
    expect(path).toBe("/etc/ssl/certs/coolify-ca.crt");
    expect(coolify(service).volumes).toEqual([`/data/coolify/ssl/coolify-ca.crt:${path}:ro`]);
  });

  it.each(services)(
    "health-checks %s with the restarting probe, its grace equal to start_period",
    (service) => {
      // Docker never restarts an unhealthy container; healthcheck.mjs does,
      // after the failures Docker counts, and never during the startup grace.
      const { test, retries, start_period } = coolify(service).healthcheck as {
        test: string[];
        retries: number;
        start_period: string;
      };
      expect(test.slice(0, 4)).toEqual(["CMD", "node", "/app/healthcheck.mjs", "--url"]);
      expect(test[test.indexOf("--grace") + 1]).toBe(start_period.replace(/s$/, ""));
      expect(test).not.toContain("--failures");
      expect(retries).toBe(3);
    },
  );

  it("health-checks web and API on paths that fail when startup validation failed", () => {
    const probe = (service: DeploymentService) => {
      const test = coolify(service).healthcheck.test;
      return test[test.indexOf("--url") + 1];
    };
    expect(probe("api")).toBe("http://127.0.0.1:3001/api/v1/health");
    expect(existsSync(join(root, "backend/apps/api/src/app/api/v1/health/route.ts"))).toBe(true);
    const web = new URL(String(probe("web")));
    expect(web.port).toBe("3000");
    // A public file that still passes through the middleware: fonts skip it
    // and would report healthy even when startup failed.
    expect(existsSync(join(root, "frontend/apps/web/public", web.pathname))).toBe(true);
    const matcher = readFileSync(join(root, "frontend/apps/web/src/proxy.ts"), "utf8");
    expect(matcher).not.toContain(web.pathname.split("/")[1] + "/");
  });
});
