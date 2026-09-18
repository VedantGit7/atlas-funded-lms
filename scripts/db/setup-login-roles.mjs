import { Client } from "pg";

/**
 * Set passwords for the non-superuser login roles created by
 * backend/prisma/sql/grants/025_03_login_roles.sql.
 *
 * Passwords are kept out of the SQL (which is committed) and supplied via env:
 *
 *   ATLAS_APP_LOGIN_PASSWORD       password for atlas_app_login
 *   ATLAS_PLATFORM_LOGIN_PASSWORD  password for atlas_platform_login
 *
 * Must be run with a connection that can ALTER ROLE (i.e. the admin/owner
 * connection in DATABASE_URL), typically once per environment after provisioning.
 */

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  console.error("DATABASE_URL is required for db:setup-login-roles");
  process.exit(1);
}

const targets = [
  { role: "atlas_app_login", password: process.env["ATLAS_APP_LOGIN_PASSWORD"] },
  { role: "atlas_platform_login", password: process.env["ATLAS_PLATFORM_LOGIN_PASSWORD"] },
];

const missing = targets.filter((t) => !t.password).map((t) => t.role);

if (missing.length > 0) {
  console.error(`Missing password env vars for: ${missing.join(", ")}`);
  console.error("Set ATLAS_APP_LOGIN_PASSWORD and ATLAS_PLATFORM_LOGIN_PASSWORD.");
  process.exit(1);
}

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  for (const { role, password } of targets) {
    const exists = await client.query(`select 1 from pg_roles where rolname = $1`, [role]);
    if (exists.rowCount === 0) {
      console.error(`Role ${role} does not exist. Run pnpm db:provision first.`);
      process.exit(1);
    }

    // Role names here are fixed literals, never user input; the password is
    // passed through pg's literal escaping rather than concatenated.
    const escaped = client.escapeLiteral(password);
    await client.query(`ALTER ROLE ${role} WITH PASSWORD ${escaped}`);
    console.log(`Set password for ${role}`);
  }

  // Fail loudly if either role could still bypass RLS.
  const { rows } = await client.query(
    `select rolname, rolsuper, rolbypassrls
       from pg_roles
      where rolname in ('atlas_app_login','atlas_platform_login')`,
  );
  const unsafe = rows.filter((r) => r.rolsuper || r.rolbypassrls);
  if (unsafe.length > 0) {
    console.error(
      `FAILED: these login roles can bypass RLS: ${unsafe.map((r) => r.rolname).join(", ")}`,
    );
    process.exit(1);
  }

  console.log("Login roles are NOSUPERUSER and NOBYPASSRLS.");
} finally {
  await client.end();
}
