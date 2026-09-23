import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { checkProctoringIntegrity } from "./check-proctoring-integrity.mjs";

// This regression uses only a fresh, dedicated fixture, never app environment URLs.
const connectionString =
  "postgres://postgres:atlas_f21_disposable_only@127.0.0.1:15442/atlas_lms_test";
const db = new Client({
  connectionString,
  options: "",
});
await db.connect();
const stage =
  "backend/prisma/migrations/20260921010000_114_proctoring_media_integrity/migration.sql";
const validation =
  "backend/prisma/migrations/20260921010100_115_validate_proctoring_media_integrity/migration.sql";
try {
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'")).rows[0]
      .n,
    0,
    "Use a fresh disposable database; never reset existing records.",
  );
  await db.query(`CREATE TABLE tenants(id uuid PRIMARY KEY);
    CREATE TABLE proctoring_sessions(id uuid PRIMARY KEY,tenant_id uuid NOT NULL);
    CREATE TABLE proctoring_events(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,proctoring_session_id uuid NOT NULL);
    CREATE TABLE proctoring_media_artifacts(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,proctoring_session_id uuid NOT NULL,proctoring_event_id uuid,retention_expires_at timestamptz NOT NULL DEFAULT now());`);
  const tenantA = randomUUID(),
    tenantB = randomUUID(),
    sessionA = randomUUID(),
    sessionB = randomUUID(),
    sessionOther = randomUUID(),
    eventA = randomUUID(),
    eventB = randomUUID(),
    eventOther = randomUUID();
  await db.query("INSERT INTO tenants VALUES($1),($2)", [tenantA, tenantB]);
  await db.query("INSERT INTO proctoring_sessions VALUES($1,$2),($3,$4),($5,$2)", [
    sessionA,
    tenantA,
    sessionB,
    tenantB,
    sessionOther,
  ]);
  await db.query("INSERT INTO proctoring_events VALUES($1,$2,$3),($4,$5,$6),($7,$2,$8)", [
    eventA,
    tenantA,
    sessionA,
    eventB,
    tenantB,
    sessionB,
    eventOther,
    sessionOther,
  ]);
  const insert = (tenant, session, event = null) =>
    db.query(
      "INSERT INTO proctoring_media_artifacts(id,tenant_id,proctoring_session_id,proctoring_event_id) VALUES($1,$2,$3,$4)",
      [randomUUID(), tenant, session, event],
    );
  // Simulate historical corrupt rows before constraint installation.
  await insert(tenantA, randomUUID());
  await insert(tenantA, sessionA, eventOther);
  await insert(randomUUID(), sessionA);
  const preflight = await checkProctoringIntegrity(connectionString);
  assert.equal(preflight.clean, false);
  assert.equal(preflight.counts.missing_tenants, 1);
  assert.equal(preflight.counts.invalid_sessions, 2);
  assert.equal(preflight.counts.invalid_events, 1);
  if (!process.argv.includes("--baseline")) await db.query(readFileSync(stage, "utf8"));
  // Baseline must fail here: PostgreSQL accepted a missing parent before F21.
  await assert.rejects(insert(tenantA, randomUUID()), { code: "23503" });
  await assert.rejects(insert(tenantA, sessionB), { code: "23503" });
  await assert.rejects(insert(tenantA, sessionA, randomUUID()), { code: "23503" });
  await assert.rejects(insert(tenantA, sessionA, eventB), { code: "23503" });
  await assert.rejects(insert(tenantA, sessionA, eventOther), { code: "23503" });
  await assert.rejects(insert(randomUUID(), sessionA), { code: "23503" });
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM proctoring_media_artifacts")).rows[0].n,
    3,
    "Staging preserves historical rows",
  );
  await assert.rejects(db.query(readFileSync(validation, "utf8")), { code: "23503" });
  await db.query("ROLLBACK");
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM pg_constraint WHERE conrelid='proctoring_media_artifacts'::regclass AND contype='f' AND convalidated",
      )
    ).rows[0].n,
    0,
  );
  // Only this verifier's disposable legacy rows are removed for the positive phase.
  await db.query("DELETE FROM proctoring_media_artifacts");
  await db.query(readFileSync(validation, "utf8"));
  await insert(tenantA, sessionA, eventA);
  await insert(tenantA, sessionA);
  await assert.rejects(
    db.query("UPDATE proctoring_media_artifacts SET proctoring_event_id=$1", [eventOther]),
    { code: "23503" },
  );
  await assert.rejects(db.query("DELETE FROM proctoring_sessions WHERE id=$1", [sessionA]), {
    code: "23503",
  });
  await assert.rejects(db.query("DELETE FROM proctoring_events WHERE id=$1", [eventA]), {
    code: "23503",
  });
  await assert.rejects(db.query("DELETE FROM tenants WHERE id=$1", [tenantA]), { code: "23503" });
  await assert.rejects(
    db.query("UPDATE proctoring_sessions SET tenant_id=$1 WHERE id=$2", [tenantB, sessionA]),
    { code: "23503" },
  );
  await db.query("DELETE FROM proctoring_media_artifacts");
  await db.query("DELETE FROM proctoring_events WHERE id=$1", [eventA]);
  await db.query("DELETE FROM proctoring_sessions WHERE id=$1", [sessionA]);
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM pg_constraint WHERE conrelid='proctoring_media_artifacts'::regclass AND contype='f' AND convalidated",
      )
    ).rows[0].n,
    3,
  );
  const finalReport = await checkProctoringIntegrity(connectionString);
  assert.equal(finalReport.clean, true);
  assert.equal(finalReport.validated, true);
  console.log(
    "F21 passed: orphan/cross-tenant/cross-session insert and update refusal, optional event, retained-parent protection, historical validation failure, and deletion after artifact cleanup.",
  );
} finally {
  await db.end();
}
