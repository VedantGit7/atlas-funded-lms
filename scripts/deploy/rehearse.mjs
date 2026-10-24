// Rehearses the Coolify deployment locally (launch plan task 1.5;
// docs/runbooks/coolify-deployment.md, "Rehearsing locally").
//
// Runs the real web, API and worker services from deploy/coolify/compose.yaml,
// built from the current source and running in deployed mode. They run against
// Postgres over verified TLS, Redis, and GoTrue behind TLS, with a throwaway
// local CA standing in for Coolify's. The database is provisioned and seeded
// by the browser-test scripts. Then it checks that a learner can log in
// through the web, that a course page renders for them, and that the worker
// completes sweeps.
//
//   pnpm deploy:rehearse                  build images, run, check, tear down
//   pnpm deploy:rehearse -- --skip-build  reuse the atlas-*:rehearsal images
//   pnpm deploy:rehearse -- --keep        leave the stack running afterwards
//
// Every credential is the disposable fixture from scripts/e2e/local-env.mjs
// or the synthetic deployment settings from tests/helpers/deployment-env.ts.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { resolve } from "node:path";
import { parse } from "dotenv";
import pg from "pg";
import { localEnv, ownerUrl } from "../e2e/local-env.mjs";
import { deploymentEnv } from "../../tests/helpers/deployment-env.ts";

const options = new Set(process.argv.slice(2).filter((arg) => arg !== "--"));
for (const option of options)
  if (!["--skip-build", "--keep"].includes(option)) throw new Error(`Unknown option ${option}`);

const output = resolve(".test-results/rehearsal");
const certs = resolve(output, "certs").replaceAll("\\", "/");
const composeEnvFile = resolve(output, "compose.env");
const project = "atlas-rehearsal";
const local = localEnv();
const authUrl = "https://auth.atlas.internal:8443";
const webPort = 3200;
const clientIp = "203.0.113.10";

const composeFiles = [
  "scripts/e2e/local-stack.compose.yml",
  "deploy/coolify/compose.yaml",
  "deploy/rehearsal/compose.yaml",
];
const compose = (args, extra = {}) =>
  execFileSync(
    "docker",
    [
      "compose",
      "-p",
      project,
      ...composeFiles.flatMap((file) => ["-f", file]),
      "--env-file",
      composeEnvFile,
      ...args,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...extra },
  );

function step(message) {
  process.stdout.write(`\n== ${message}\n`);
}

function run(command, args, { env = process.env, log } = {}) {
  const fd = log ? openSync(resolve(output, log), "w") : "inherit";
  const result = spawnSync(command, args, { env, stdio: ["ignore", fd, fd] });
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(" ")} failed${log ? ` (see ${output}/${log})` : ""}`);
}

/** A throwaway CA and server certificates for the two TLS endpoints. */
function makeCertificates() {
  rmSync(certs, { recursive: true, force: true });
  mkdirSync(certs, { recursive: true });
  const script = [
    "set -e",
    "cd /out",
    // Self-signed through x509 -req so the CA carries exactly these extensions:
    // req -x509 adds the image's defaults too, and a duplicate basicConstraints
    // makes OpenSSL and Node reject the CA.
    'printf "basicConstraints=critical,CA:TRUE\\nkeyUsage=critical,keyCertSign,cRLSign\\nsubjectKeyIdentifier=hash\\n" > ca.ext',
    'openssl req -new -newkey rsa:2048 -nodes -subj "/CN=Atlas rehearsal CA" -keyout ca.key -out ca.csr',
    "openssl x509 -req -in ca.csr -signkey ca.key -days 7 -extfile ca.ext -out ca.crt",
    "for host in database.atlas.internal auth.atlas.internal; do",
    '  openssl req -newkey rsa:2048 -nodes -subj "/CN=$host" -keyout $host.key -out $host.csr',
    '  printf "subjectAltName=DNS:%s\\nextendedKeyUsage=serverAuth\\n" $host > $host.ext',
    "  openssl x509 -req -in $host.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 7 -extfile $host.ext -out $host.crt",
    "done",
    "openssl verify -x509_strict -CAfile ca.crt database.atlas.internal.crt auth.atlas.internal.crt",
    "chmod 644 *.crt *.key",
  ].join("\n");
  // Kong's image is already part of the stack and ships the openssl CLI.
  run("docker", [
    "run",
    "--rm",
    "--user",
    "root",
    "--entrypoint",
    "sh",
    "-v",
    `${certs}:/out`,
    "public.ecr.aws/supabase/kong:2.8.1",
    "-c",
    script,
  ]);
}

function buildImages() {
  const publicSettings = [
    "APP_ENV=staging",
    `NEXT_PUBLIC_SUPABASE_URL=${authUrl}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${local.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
  ];
  writeFileSync(resolve(output, "api-build.env"), `${publicSettings.join("\n")}\n`);
  writeFileSync(
    resolve(output, "web-build.env"),
    `${[...publicSettings, "API_INTERNAL_URL=http://api.atlas.internal:3001"].join("\n")}\n`,
  );
  for (const [target, secret] of [
    ["api", "api_build_env"],
    ["web", "web_build_env"],
    ["worker", null],
  ]) {
    step(`Building atlas-${target}:rehearsal (log: ${output}/build-${target}.log)`);
    const secretArgs = secret
      ? ["--secret", `id=${secret},src=${resolve(output, `${target}-build.env`)}`]
      : [];
    run(
      "docker",
      [
        "build",
        "-f",
        "deploy/managed-node/Dockerfile",
        "--target",
        target,
        ...secretArgs,
        "-t",
        `atlas-${target}:rehearsal`,
        ".",
      ],
      { log: `build-${target}.log` },
    );
  }
}

/** Interpolation values for the compose files: the deployed settings. */
function writeComposeEnv(tenantHost) {
  const runtime = (role, password) =>
    `postgresql://${role}:${password}@database.atlas.internal:5432/atlas_lms_e2e?sslmode=verify-full`;
  const settings = {
    ...deploymentEnv(),
    APP_ENV: "staging",
    APP_URL: `https://${tenantHost}`,
    DATABASE_URL: runtime("atlas_app_login", local.ATLAS_APP_LOGIN_PASSWORD),
    PLATFORM_DATABASE_URL: runtime("atlas_platform_login", local.ATLAS_PLATFORM_LOGIN_PASSWORD),
    RATE_LIMIT_REDIS_URL: "redis://redis:6379",
    NEXT_PUBLIC_SUPABASE_URL: authUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: local.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: local.SUPABASE_SERVICE_ROLE_KEY,
    REHEARSAL_CERTS: certs,
  };
  const lines = Object.entries(settings)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${key}=${value}`);
  writeFileSync(composeEnvFile, `${lines.join("\n")}\n`, { mode: 0o600 });
  return settings;
}

async function waitFor(label, check, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((done) => setTimeout(done, 2000));
  }
}

/** A request to web as Cloudflare would send it: the tenant host and client IP. */
function request(method, path, { host, cookies = "", body } = {}) {
  return new Promise((done, fail) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        host: "127.0.0.1",
        port: webPort,
        method,
        path,
        headers: {
          host,
          origin: `https://${host}`,
          "x-forwarded-proto": "https",
          "cf-connecting-ip": clientIp,
          ...(cookies ? { cookie: cookies } : {}),
          ...(payload ? { "content-type": "application/json" } : {}),
        },
      },
      (response) => {
        let text = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => (text += chunk));
        response.on("end", () =>
          done({ status: response.statusCode, headers: response.headers, text }),
        );
      },
    );
    req.on("error", fail);
    if (payload) req.write(payload);
    req.end();
  });
}

async function owner(query, values) {
  const client = new pg.Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    return (await client.query(query, values)).rows;
  } finally {
    await client.end();
  }
}

const results = [];
function record(check, ok, detail) {
  results.push({ check, ok, detail });
  process.stdout.write(`${ok ? "PASS" : "FAIL"} ${check}: ${detail}\n`);
}

mkdirSync(output, { recursive: true });
let failed;
try {
  // The compose files interpolate every setting; the tenant host is known
  // only after seeding, so start with a placeholder and rewrite it later.
  writeComposeEnv("pending.invalid");
  // A stack left by --keep holds the certificates open.
  try {
    compose(["down", "-v", "--remove-orphans"]);
  } catch {
    // Nothing to remove.
  }

  step("Certificates (throwaway local CA)");
  makeCertificates();

  if (!options.has("--skip-build")) buildImages();

  const up = (services, timeout = "120") =>
    compose(["up", "-d", "--wait", "--wait-timeout", timeout, "--pull", "never", ...services]);
  step("Starting Postgres (TLS) and Redis");
  up(["database", "redis"]);

  step("Provisioning the database (browser-test scripts)");
  const provisionEnv = { ...process.env, ...local };
  run(process.execPath, ["scripts/e2e/setup-local.mjs"], { env: provisionEnv, log: "setup.log" });

  // GoTrue needs its database and role, which setup-local.mjs creates.
  step("Starting GoTrue and Kong (TLS), then seeding");
  up(["auth", "gateway"]);
  await waitFor(
    "GoTrue",
    () =>
      fetch("http://127.0.0.1:54326/auth/v1/health", {
        headers: { apikey: local.SUPABASE_ANON_KEY },
      })
        .then((response) => response.ok)
        .catch(() => false),
    90,
  );
  run(process.execPath, ["scripts/e2e/local-run.mjs", "seed"], {
    env: provisionEnv,
    log: "seed.log",
  });
  const credentials = parse(readFileSync(local.E2E_CREDENTIALS_PATH));
  const scenario = JSON.parse(readFileSync(local.E2E_SCENARIO_PATH, "utf8"));
  const [{ hostname: tenantHost }] = await owner(
    `select d.hostname from tenant_domains d join tenants t on t.id = d.tenant_id
     where t.slug = $1 and d.deleted_at is null order by d.created_at limit 1`,
    [local.E2E_TENANT_SLUG],
  );
  const [{ title: courseTitle }] = await owner("select title from courses where id = $1", [
    scenario.courseId,
  ]);

  writeComposeEnv(tenantHost);
  step(`Starting web, API and worker (tenant host ${tenantHost})`);
  up(["web", "api", "worker"], "300");
  record("containers healthy", true, "web, api and worker report healthy");

  step("Checks");
  const login = await request("POST", "/api/v1/public/auth/login", {
    host: tenantHost,
    body: { email: credentials.E2E_LEARNER_EMAIL, password: credentials.E2E_LEARNER_PASSWORD },
  });
  const cookies = (login.headers["set-cookie"] ?? [])
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
  record(
    "learner login through web",
    login.status === 200 && cookies.includes("="),
    `HTTP ${login.status}, ${(login.headers["set-cookie"] ?? []).length} cookies set`,
  );

  const course = await request("GET", `/courses/${scenario.courseId}`, {
    host: tenantHost,
    cookies,
  });
  record(
    "course page renders for the learner",
    course.status === 200 && course.text.includes(courseTitle),
    `HTTP ${course.status}, title "${courseTitle}" ${course.text.includes(courseTitle) ? "found" : "missing"}`,
  );

  const sweep = await waitFor(
    "a worker sweep",
    () =>
      compose(["logs", "--no-color", "worker"])
        .split("\n")
        .find((line) => line.includes("worker.sweep.completed")),
    150,
  ).catch(() => null);
  record(
    "worker completes a sweep",
    Boolean(sweep),
    sweep ? "worker.sweep.completed logged" : "no sweep logged",
  );

  const connections = await owner(
    `select a.usename, bool_and(s.ssl) as tls, count(*)::int as connections
     from pg_stat_activity a join pg_stat_ssl s on s.pid = a.pid
     where a.usename in ('atlas_app_login', 'atlas_platform_login') group by a.usename`,
  );
  record(
    "runtime database connections use TLS",
    connections.length > 0 && connections.every((row) => row.tls),
    connections.map((row) => `${row.usename}: ${row.connections}, tls=${row.tls}`).join("; ") ||
      "no runtime connections",
  );
  failed = results.some((result) => !result.ok);
} catch (error) {
  failed = true;
  process.stdout.write(`\nREHEARSAL ERROR: ${error.message}\n`);
  try {
    process.stdout.write(compose(["ps", "--format", "{{.Service}}: {{.Status}}"]));
  } catch {
    // The stack may not have started.
  }
} finally {
  writeFileSync(resolve(output, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  if (options.has("--keep")) {
    process.stdout.write(
      `\nStack left running (project ${project}); web on http://127.0.0.1:${webPort}.\n`,
    );
  } else {
    step("Tearing down");
    try {
      compose(["down", "-v", "--remove-orphans"]);
    } catch {
      // Already gone.
    }
  }
}
process.stdout.write(`\n${failed ? "REHEARSAL FAILED" : "REHEARSAL PASSED"}\n`);
process.exit(failed ? 1 : 0);
