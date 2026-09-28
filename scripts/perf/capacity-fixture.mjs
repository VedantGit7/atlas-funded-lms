// Private disposable fixtures for this local capacity experiment only.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { localEnv } from "../e2e/local-env.mjs";

export const PRIVATE_CONFIG_PATH = resolve(
  ".test-results/performance-2026-09-26/capacity-private.json",
);
export function assertCapacityTarget({ databaseUrl, authUrl, acknowledged }) {
  const db = new URL(databaseUrl),
    auth = new URL(authUrl);
  if (
    acknowledged !== true ||
    !["postgres:", "postgresql:"].includes(db.protocol) ||
    db.hostname !== "127.0.0.1" ||
    db.port !== "15436" ||
    db.pathname !== "/atlas_lms_e2e" ||
    db.username !== "atlas" ||
    db.search ||
    db.hash ||
    auth.origin !== "http://127.0.0.1:54326" ||
    auth.pathname !== "/" ||
    auth.search ||
    auth.hash ||
    auth.username ||
    auth.password
  )
    throw new Error(
      "Capacity fixtures require the explicitly acknowledged isolated local database and auth ports.",
    );
}
export function makeCapacityConfig(fixture) {
  return {
    mode: "local-endurance",
    disposableFixtures: true,
    origin: "http://fundedbeyond.localhost:3100",
    build: "local-performance-2026-09-26-runtime-must-be-recorded",
    fixtureProxyToken: randomBytes(32).toString("hex"),
    pacingMs: 20000,
    setupPacingMs: 250,
    timeoutMs: 60000,
    refreshIntervalMs: 300000,
    slo: { requestP95Ms: 1000, journeyP95Ms: 3000 },
    phases: [
      { name: "warmup", users: 100, seconds: 120 },
      { name: "sustained", users: 100, seconds: 900 },
      { name: "burst", users: 200, seconds: 300 },
      { name: "endurance", users: 100, seconds: 7200 },
    ],
    fixture: { courseId: fixture.courseId, lessonId: fixture.lessonId, positionSeconds: 30 },
    users: Array.from({ length: 200 }, (_, actorIndex) => ({
      actorIndex,
      email: `perf20260926-${String(actorIndex).padStart(3, "0")}+fundedbeyond@atlas-e2e.test`,
      password: `Perf-${randomBytes(24).toString("base64url")}-1a!`,
    })),
  };
}

export async function seedCapacity({ acknowledged = false } = {}) {
  const env = localEnv();
  assertCapacityTarget({ databaseUrl: env.DATABASE_URL, authUrl: env.SUPABASE_URL, acknowledged });
  const [{ default: pg }, { createClient }, { readFileSync }] = await Promise.all([
    import("pg"),
    import("@supabase/supabase-js"),
    import("node:fs"),
  ]);
  const fixture = JSON.parse(readFileSync(env.E2E_SCENARIO_PATH, "utf8"));
  const config = makeCapacityConfig(fixture);
  const db = new pg.Client({ connectionString: env.DATABASE_URL });
  const auth = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await db.connect();
  try {
    const checked = await db.query(
      `select t.id as tenant_id, r.id as role_id from tenants t join roles r on r.tenant_id=t.id and r.key='learner' and r.deleted_at is null join courses c on c.tenant_id=t.id and c.id=$1::uuid and c.status='PUBLISHED' join course_modules cm on cm.course_id=c.id join lessons l on l.module_id=cm.id and l.id=$2::uuid and l.status='PUBLISHED' where t.slug='fundedbeyond' and t.deleted_at is null`,
      [fixture.courseId, fixture.lessonId],
    );
    if (checked.rowCount !== 1 || checked.rows[0].tenant_id !== fixture.tenantId)
      throw new Error("Expected the published isolated F16 learning scenario and learner role.");
    const { tenant_id: tenantId, role_id: roleId } = checked.rows[0];
    // Write before creating identities so even a partial seed retains its credentials.
    mkdirSync(dirname(PRIVATE_CONFIG_PATH), { recursive: true });
    writeFileSync(PRIVATE_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    const existing = new Map();
    for (let page = 1; page <= 10; page++) {
      const listed = await auth.auth.admin.listUsers({ page, perPage: 1000 });
      if (listed.error) throw new Error("Could not inspect isolated auth fixtures.");
      for (const user of listed.data.users) existing.set(user.email, user.id);
      if (listed.data.users.length < 1000) break;
      if (page === 10) throw new Error("Unexpectedly large isolated fixture user directory.");
    }
    for (const user of config.users) {
      const previous = existing.get(user.email);
      const seeded = previous
        ? await auth.auth.admin.updateUserById(previous, {
            password: user.password,
            email_confirm: true,
          })
        : await auth.auth.admin.createUser({
            email: user.email,
            password: user.password,
            email_confirm: true,
          });
      if (seeded.error || !seeded.data.user?.id)
        throw new Error("Could not seed a disposable auth identity.");
      await db.query("BEGIN");
      try {
        const principal = await db.query(
          `insert into auth_principals(id,supabase_user_id,email,email_normalized,global_status,created_at,updated_at) values($1,$2,$3,lower($3),'active',now(),now()) on conflict(email_normalized) do update set supabase_user_id=excluded.supabase_user_id,email=excluded.email,global_status='active',updated_at=now() returning id`,
          [randomUUID(), seeded.data.user.id, user.email],
        );
        const member = await db.query(
          `insert into memberships(id,tenant_id,auth_principal_id,status,joined_at,created_at,updated_at) values($1,$2,$3,'ACTIVE',now(),now(),now()) on conflict(tenant_id,auth_principal_id) do update set status='ACTIVE',updated_at=now() returning id`,
          [randomUUID(), tenantId, principal.rows[0].id],
        );
        await db.query(
          `insert into user_roles(id,tenant_id,membership_id,role_id,created_at) values($1,$2,$3,$4,now()) on conflict(tenant_id,membership_id,role_id) do nothing`,
          [randomUUID(), tenantId, member.rows[0].id, roleId],
        );
        await db.query("COMMIT");
      } catch (error) {
        await db.query("ROLLBACK");
        throw error;
      }
    }
    const verified = await db.query(
      `select count(distinct p.id)::int as count from auth_principals p join memberships m on m.auth_principal_id=p.id and m.tenant_id=$1 and m.status='ACTIVE' join user_roles ur on ur.membership_id=m.id and ur.tenant_id=$1 and ur.role_id=$2 where p.email=any($3::text[]) and p.global_status='active'`,
      [tenantId, roleId, config.users.map((u) => u.email)],
    );
    if (verified.rows[0].count !== 200) throw new Error("Disposable learner verification failed.");
    return { learners: 200, configPath: PRIVATE_CONFIG_PATH };
  } finally {
    await db.end();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.log(
      JSON.stringify(
        await seedCapacity({ acknowledged: process.argv.includes("--ack-local-disposable") }),
      ),
    );
  } catch {
    console.error(
      "Capacity fixture seed failed. Check the explicitly acknowledged isolated stack and published F16 scenario. No credentials are logged.",
    );
    process.exitCode = 1;
  }
}
