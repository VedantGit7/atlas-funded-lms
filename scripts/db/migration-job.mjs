// The database migration job (launch plan task 2.3; docs/runbooks/
// coolify-deployment.md, "Database migrations"). It ships as the atlas-migrate
// image, published with every release, and runs once per deploy on the
// environment's private Docker network:
//
//   migrate      provision an empty database, or bring one this job
//                provisioned up to this release (provision-database.mjs)
//   login-roles  set the runtime logins' passwords (setup-login-roles.mjs)
//   verify       report what the release relies on: owner, logins, migrations,
//                row-level security, and that this connection uses TLS
//
// DATABASE_URL is the database owner's login with sslmode=verify-full, and
// NODE_EXTRA_CA_CERTS names the CA that signed the server's certificate, as
// for the app's own services. Prisma's migration engine doesn't read Node's CA
// settings, so its commands get the same URL with the CA file in it instead
// (Prisma's sslcert means the server's root certificate; pg's means a client
// certificate, so the two can't share one URL).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const command = process.argv[2];
const databaseUrl = process.env["DATABASE_URL"];
const ca = process.env["NODE_EXTRA_CA_CERTS"];

function fail(message) {
  process.stderr.write(`migration job: ${message}\n`);
  process.exit(1);
}

if (!["migrate", "login-roles", "verify"].includes(command ?? ""))
  fail("usage: migration-job.mjs migrate|login-roles|verify");
if (!databaseUrl) fail("DATABASE_URL (the owner login) is required");
const url = new URL(databaseUrl);
if (url.searchParams.get("sslmode") !== "verify-full")
  fail("DATABASE_URL must use sslmode=verify-full: the job checks the server's certificate");
if (!ca || !existsSync(ca)) fail("NODE_EXTRA_CA_CERTS must name the mounted CA certificate");

/** The owner URL in the form Prisma's engine verifies: CA file, strict checks. */
function prismaUrl() {
  const prisma = new URL(databaseUrl);
  prisma.searchParams.set("sslmode", "require");
  prisma.searchParams.set("sslcert", ca);
  prisma.searchParams.set("sslaccept", "strict");
  return prisma.href;
}

function run(script, args = []) {
  execFileSync(process.execPath, [join(repoRoot, script), ...args], {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, DIRECT_DATABASE_URL: prismaUrl() },
  });
}

async function query(sql) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    return (await client.query(sql)).rows;
  } finally {
    await client.end();
  }
}

if (command === "migrate") {
  const [state] = await query(
    `select (select count(*)::int from information_schema.tables
              where table_schema = 'public' and table_type = 'BASE TABLE') as tables,
            to_regclass('public._prisma_migrations') is not null as tracked`,
  );
  const release = state.tables > 0;
  process.stdout.write(
    release
      ? `Bringing a provisioned database (${state.tables} tables) up to this release.\n`
      : "Provisioning an empty database.\n",
  );
  run("scripts/db/provision-database.mjs", release ? ["--release"] : []);
  run("scripts/guards/check-migrate-status.mjs");
} else if (command === "login-roles") {
  run("scripts/db/setup-login-roles.mjs");
} else {
  const [report] = await query(`
    select current_user as owner,
           (select rolsuper from pg_roles where rolname = current_user) as owner_is_superuser,
           (select count(*)::int from _prisma_migrations where finished_at is not null) as migrations,
           (select count(*)::int from _prisma_migrations where finished_at is null) as unfinished,
           (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity) as rls_tables,
           (select count(*)::int from pg_policies where schemaname = 'public') as policies,
           (select json_agg(json_build_object('role', rolname, 'login', rolcanlogin,
                    'superuser', rolsuper, 'bypassrls', rolbypassrls,
                    'connect', has_database_privilege(rolname, current_database(), 'CONNECT'))
                    order by rolname)
              from pg_roles where rolname in ('atlas_app_login', 'atlas_platform_login')) as logins,
           (select ssl from pg_stat_ssl where pid = pg_backend_pid()) as tls`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  const logins = report.logins ?? [];
  const unsafeLogin = logins.some((login) => login.superuser || login.bypassrls);
  // A login that can't connect fails every request, so it fails here first.
  const lockedOut = logins.length < 2 || logins.some((login) => !login.login || !login.connect);
  if (!report.tls || report.unfinished > 0 || unsafeLogin || lockedOut)
    fail("verification failed: see the report above");
}
