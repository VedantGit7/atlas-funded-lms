/**
 * Seed the users the authenticated browser journeys log in as.
 *
 * Ten of the eleven journeys in `tests/browser/journeys-registry.ts` need a real
 * session. They were skipping everywhere — locally because nobody had created
 * the users, and in CI because nothing had ever set the credentials — so the
 * suite reported green while proving nothing about a logged-in page.
 *
 * Login goes through Supabase `signInWithPassword`, so a journey user is two
 * rows in two systems: a Supabase auth user (the password) and a tenant
 * membership with a role (the authorization). This creates both, idempotently,
 * so a pipeline can run it on every job and a contributor can run it once.
 *
 * Usage:
 *   pnpm e2e:seed-users                 # seed against .env.local
 *   pnpm e2e:seed-users -- --print-env  # also print the E2E_* lines to export
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 * and DATABASE_URL. It refuses to run without an explicit tenant slug so it can
 * never be pointed at a production tenant by accident.
 */

import { randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
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
  // membership. Its authority comes from PLATFORM_OPERATOR_ASSIGNMENTS, which
  // is how the system grants platform operators everywhere else.
  { envPrefix: "E2E_PLATFORM", role: null, local: "e2e-platform" },
];

/** The role granted to the platform journey user via the env assignment map. */
const PLATFORM_ROLE_KEY = "super_admin";

function fail(message) {
  console.error(`\nE2E user seeding FAILED: ${message}\n`);
  process.exit(1);
}

const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["NEXT_PUBLIC_SUPABASE_URL"];
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const databaseUrl = process.env["DATABASE_URL"];

if (!supabaseUrl) fail("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) is not set.");
if (!serviceRoleKey) fail("SUPABASE_SERVICE_ROLE_KEY is not set.");
if (!databaseUrl) fail("DATABASE_URL is not set.");
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

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** The email a journey user logs in with, namespaced by tenant. */
function emailFor(user) {
  return `${user.local}+${tenantSlug}@atlas-e2e.test`;
}

/**
 * Create the Supabase auth user, or update the password if it already exists.
 * Idempotent so a pipeline can call this on every run.
 */
async function upsertAuthUser(email) {
  const created = await supabase.auth.admin.createUser({
    email,
    password: passwordFromEnv,
    email_confirm: true,
  });

  if (!created.error) return created.data.user.id;

  // Already present: find it and reset the password so the credential the
  // pipeline holds is always the one that works.
  const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error) fail(`could not list Supabase users: ${listed.error.message}`);

  const existing = listed.data.users.find((candidate) => candidate.email === email);
  if (!existing)
    fail(`could not create or find the Supabase user ${email}: ${created.error.message}`);

  const updated = await supabase.auth.admin.updateUserById(existing.id, {
    password: passwordFromEnv,
    email_confirm: true,
  });
  if (updated.error) fail(`could not reset the password for ${email}: ${updated.error.message}`);

  return existing.id;
}

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
  const platformEmails = [];

  for (const user of USERS) {
    const email = emailFor(user);
    const authUserId = await upsertAuthUser(email);

    let roleId = null;
    if (user.role !== null) {
      const role = await client.query(
        `select id::text as id from roles where tenant_id = $1::uuid and key = $2 and deleted_at is null limit 1`,
        [tenantId, user.role],
      );
      roleId = role.rows[0]?.id ?? null;
      if (!roleId) {
        fail(
          `tenant "${tenantSlug}" has no "${user.role}" role. Run pnpm db:seed:catalogues first.`,
        );
      }
    }

    // auth_principals is global, not tenant-scoped: one Supabase identity, one
    // row, reused by every tenant the person belongs to.
    //
    // The conflict target is the email, not supabase_user_id, because the email
    // is the stable identifier and the Supabase id is not. Recreating the local
    // auth stack issues new user ids for the same people; keying on the id then
    // missed the existing row and hit the unique constraint on the email
    // instead, which is a failure this script exists to avoid. Re-pointing the
    // id is the correct repair.
    const principal = await client.query(
      `insert into auth_principals (
         id, supabase_user_id, email, email_normalized, global_status, created_at, updated_at
       )
       values ($1::uuid, $2::uuid, $3, lower($3), 'active', now(), now())
       on conflict (email_normalized)
       do update set
         supabase_user_id = excluded.supabase_user_id,
         email = excluded.email,
         global_status = 'active',
         updated_at = now()
       returning id::text as id`,
      [randomUUID(), authUserId, email],
    );
    const principalId = principal.rows[0].id;

    if (roleId !== null) {
      const membership = await client.query(
        `insert into memberships (id, tenant_id, auth_principal_id, status, joined_at, created_at, updated_at)
         values ($1::uuid, $2::uuid, $3::uuid, 'ACTIVE', now(), now(), now())
         on conflict (tenant_id, auth_principal_id)
         do update set status = 'ACTIVE', updated_at = now()
         returning id::text as id`,
        [randomUUID(), tenantId, principalId],
      );
      const membershipId = membership.rows[0].id;

      await client.query(
        `insert into user_roles (id, tenant_id, membership_id, role_id, created_at)
         values ($1::uuid, $2::uuid, $3::uuid, $4::uuid, now())
         on conflict (tenant_id, membership_id, role_id) do nothing`,
        [randomUUID(), tenantId, membershipId, roleId],
      );
    } else {
      platformEmails.push(email);
    }

    console.log(`seeded ${(user.role ?? "platform").padEnd(10)} ${email}`);
    lines.push(`${user.envPrefix}_EMAIL=${email}`);
    lines.push(`${user.envPrefix}_PASSWORD=${passwordFromEnv}`);
  }

  if (platformEmails.length > 0) {
    // Platform authority is configuration, not a database row: the API reads
    // this map at request time. Emitting it here keeps the grant next to the
    // identity it grants, so the two cannot drift.
    lines.push(
      `PLATFORM_OPERATOR_ASSIGNMENTS=${platformEmails
        .map((address) => `${address}=${PLATFORM_ROLE_KEY}`)
        .join(",")}`,
    );
  }

  if (printEnv) {
    // Printed only on request: the password is a secret, and a script that
    // echoes it by default ends up in a CI log.
    console.log("\n# Journey credentials\n" + lines.join("\n"));
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
}
