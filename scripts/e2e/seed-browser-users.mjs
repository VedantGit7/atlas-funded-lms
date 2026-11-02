/**
 * Seed the users the authenticated browser journeys log in as.
 *
 * Ten of the eleven journeys in `tests/browser/journeys-registry.ts` need a real
 * session. They were skipping everywhere — locally because nobody had created
 * the users, and in CI because nothing had ever set the credentials — so the
 * suite reported green while proving nothing about a logged-in page.
 *
 * Login goes through Better Auth (launch plan task 3.7), so a journey user is
 * a principal that signs in with a password (and, for the admin and platform
 * journeys, a verified authenticator) plus a tenant membership with a role
 * (the authorization). This creates both, idempotently, so a pipeline can run
 * it on every job and a contributor can run it once.
 *
 * Usage (it imports the Better Auth flows, so it runs under tsx):
 *   node scripts/e2e/local-run.mjs seed # use the isolated local stack
 *   pnpm e2e:seed-users -- --print-env  # also print the E2E_* lines to export
 *
 * Requires DATABASE_URL and BETTER_AUTH_SECRET, the same secret the API runs
 * with, which encrypts the authenticators. It requires an explicit tenant slug
 * and a guarded local database so it can never be pointed at a production
 * tenant by accident.
 */

import { randomUUID } from "node:crypto";
import { appendFileSync, writeFileSync } from "node:fs";
import { assertIsolatedFixtureTarget } from "./isolated-target.mjs";
import { authPrisma } from "@atlas/db/auth-client";
import { enrolFixtureAuthenticator, upsertFixtureLogin } from "./better-auth-fixture-logins";
import pg from "pg";

const args = process.argv.slice(2);
const printEnv = args.includes("--print-env");

function arg(name, fallback) {
  const hit = args.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const tenantSlug = arg("tenant", process.env["E2E_TENANT_SLUG"]);
const passwordFromEnv = process.env["E2E_SEED_PASSWORD"];

/**
 * The journey users. Roles match `TENANT_SYSTEM_ROLES`; the reviewer and
 * moderator journeys authenticate as an admin, which is what the specs
 * themselves require (`hasAdminCredentials`).
 */
const USERS = [
  { envPrefix: "E2E_LEARNER", role: "learner", local: "e2e-learner" },
  { envPrefix: "E2E_INSTRUCTOR", role: "instructor", local: "e2e-instructor" },
  { envPrefix: "E2E_ADMIN", role: "admin", local: "e2e-admin" },
  // The platform plane is not a tenant: J10 runs against the platform host,
  // which never resolves a tenant, so this user gets an identity and no
  // membership. Its authority comes from an explicit database grant below.
  { envPrefix: "E2E_PLATFORM", role: null, local: "e2e-platform" },
  { envPrefix: "E2E_ROLE_TARGET", role: "learner", local: "e2e-role-target" },
  {
    envPrefix: "E2E_FOREIGN_ADMIN",
    role: "admin",
    local: "e2e-foreign-admin",
    tenantSlug: "second-smoke-academy",
  },
];

/** The role recorded for a newly created platform journey fixture. */
const PLATFORM_ROLE_KEY = "super_admin";

function fail(message) {
  console.error(`\nE2E user seeding FAILED: ${message}\n`);
  process.exit(1);
}

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) fail("DATABASE_URL is not set.");
if (!process.env["BETTER_AUTH_SECRET"]) {
  fail("BETTER_AUTH_SECRET is not set. Use the one the API runs with, or its sign-ins fail.");
}
assertIsolatedFixtureTarget({ databaseUrl });
if (!tenantSlug) {
  fail(
    "No tenant given. Pass --tenant=<slug> or set E2E_TENANT_SLUG. " +
      "This is required rather than defaulted so the script cannot be aimed at a production tenant by accident.",
  );
}
if (!passwordFromEnv) {
  fail(
    "E2E_SEED_PASSWORD is not set. Supply one from the pipeline's secret store rather than " +
      "letting this script invent a password it would then have to print.",
  );
}

/** The email a journey user logs in with, namespaced by tenant. */
function emailFor(user) {
  return `${user.local}+${tenantSlug}@atlas-e2e.test`;
}

/** Any host does for seeding; the journeys sign in on their own. */
const SEED_HOST = `${tenantSlug}.localhost`;

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  const tenant = await client.query(
    `select id::text as id from tenants where slug = $1 and deleted_at is null limit 1`,
    [tenantSlug],
  );
  const tenantId = tenant.rows[0]?.id;
  if (!tenantId)
    fail(`no tenant with slug "${tenantSlug}". Seed tenants first (pnpm db:seed:tenants).`);

  const lines = [];

  for (const user of USERS) {
    const email = emailFor(user);
    const principalId = await upsertFixtureLogin(email, passwordFromEnv);
    const userTenant = user.tenantSlug
      ? (await client.query("select id::text as id from tenants where slug=$1", [user.tenantSlug]))
          .rows[0]?.id
      : tenantId;
    if (!userTenant) throw new Error("Missing foreign fixture tenant");

    if (user.role === "admin" || user.role === null) {
      // Real enrollment and verification: the resulting session must be AAL2.
      const secret = await enrolFixtureAuthenticator({
        principalId,
        email,
        password: passwordFromEnv,
        host: SEED_HOST,
      });
      lines.push(`${user.envPrefix}_TOTP_SECRET=${secret}`);
    }

    let roleId = null;
    if (user.role !== null) {
      const role = await client.query(
        `select id::text as id from roles where tenant_id = $1::uuid and key = $2 and deleted_at is null limit 1`,
        [userTenant, user.role],
      );
      roleId = role.rows[0]?.id ?? null;
      if (!roleId) {
        fail(
          `tenant "${tenantSlug}" has no "${user.role}" role. Run pnpm db:seed:catalogues first.`,
        );
      }
    }

    if (roleId !== null) {
      const membership = await client.query(
        `insert into memberships (id, tenant_id, auth_principal_id, status, joined_at, created_at, updated_at)
         values ($1::uuid, $2::uuid, $3::uuid, 'ACTIVE', now(), now(), now())
         on conflict (tenant_id, auth_principal_id)
         do update set status = 'ACTIVE', updated_at = now()
         returning id::text as id`,
        [randomUUID(), userTenant, principalId],
      );
      const membershipId = membership.rows[0].id;

      await client.query(
        `insert into user_roles (id, tenant_id, membership_id, role_id, created_at)
         values ($1::uuid, $2::uuid, $3::uuid, $4::uuid, now())
         on conflict (tenant_id, membership_id, role_id) do nothing`,
        [randomUUID(), userTenant, membershipId, roleId],
      );
    } else {
      // This is explicit fixture setup, never a request-time fallback. Serialize
      // the history check and insertion so a concurrent seed/revocation cannot
      // turn a previously revoked grant into an accidental new grant.
      await client.query("BEGIN");
      try {
        await client.query("LOCK TABLE platform_operators IN SHARE ROW EXCLUSIVE MODE");
        const history = await client.query(
          `select role_key, revoked_at from platform_operators
           where auth_principal_id = $1::uuid`,
          [principalId],
        );
        if (history.rows.length === 0) {
          await client.query(
            `insert into platform_operators (
               id, auth_principal_id, role_key, granted_by_principal_id, grant_reason
             ) values ($1::uuid, $2::uuid, $3, $2::uuid, $4)`,
            [
              randomUUID(),
              principalId,
              PLATFORM_ROLE_KEY,
              `Browser test fixture for ${tenantSlug}`,
            ],
          );
        } else {
          const activeGrant = history.rows.find((row) => row.revoked_at === null);
          if (!activeGrant) {
            throw new Error(
              "Platform fixture grant was revoked; explicit operator review is required.",
            );
          }
          if (activeGrant.role_key !== PLATFORM_ROLE_KEY) {
            throw new Error(
              "Platform fixture role differs; refusing to overwrite an existing grant.",
            );
          }
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log(`seeded ${(user.role ?? "platform").padEnd(10)} ${email}`);
    lines.push(`${user.envPrefix}_EMAIL=${email}`);
    lines.push(`${user.envPrefix}_PASSWORD=${passwordFromEnv}`);
  }

  if (printEnv) {
    // Printed only on request: the password is a secret, and a script that
    // echoes it by default ends up in a CI log.
    console.log("\n# Journey credentials\n" + lines.join("\n"));
  }
  if (process.env["E2E_CREDENTIALS_PATH"]) {
    writeFileSync(process.env["E2E_CREDENTIALS_PATH"], `${lines.join("\n")}\n`, { mode: 0o600 });
  }

  // Hand the credentials to the following workflow steps. The specs read
  // E2E_*_EMAIL / E2E_*_PASSWORD from the environment, and the emails are
  // derived here rather than duplicated in the workflow, so the two cannot
  // drift. GitHub masks the password because it arrived from a secret.
  const githubEnv = process.env["GITHUB_ENV"];
  if (githubEnv) {
    appendFileSync(githubEnv, `${lines.join("\n")}\n`, "utf8");
    console.log(`Exported ${lines.length} credential variables to GITHUB_ENV.`);
  }

  console.log(`\nSeeded ${USERS.length} journey users for tenant "${tenantSlug}".`);
} finally {
  await client.end();
  // Better Auth's own pool, or the process waits on its idle connections.
  await authPrisma().$disconnect();
}
