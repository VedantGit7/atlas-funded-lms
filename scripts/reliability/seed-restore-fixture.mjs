#!/usr/bin/env node
import { execFileSync } from "node:child_process";

// Explicitly disposable local PostgreSQL fixtures only. Never reads dotenv files.
// Root orchestration must finish any active restore before executing this CLI.
const container = process.env.RESTORE_DRILL_CONTAINER?.trim();
const dbUser = process.env.RESTORE_DRILL_USER?.trim();
const sourceDb = process.env.RESTORE_DRILL_SOURCE_DB?.trim();
let phase = "configuration";

try {
  if (process.env.RESTORE_DRILL_SEED_FIXTURE !== "1") throw new Error("Missing consent");
  if (!container || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(container))
    throw new Error("Invalid container");
  if (dbUser !== "atlas") throw new Error("Only the local atlas superuser is allowed");
  if (!["atlas_lms_ci", "atlas_lms_ops_source"].includes(sourceDb))
    throw new Error("Not a disposable fixture database");

  // Lock before checking emptiness so another writer cannot race the guard.
  // No upsert, reuse, truncate or delete: an existing fixture must be inspected.
  const sql = `
BEGIN;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '5s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
LOCK TABLE public.tenants, public.tenant_domains, public.tenant_usage_events IN SHARE ROW EXCLUSIVE MODE;
DO $guard$
BEGIN
  IF current_database() NOT IN ('atlas_lms_ci', 'atlas_lms_ops_source') OR
     current_user <> 'atlas' OR
     NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper) OR
     pg_is_in_recovery() THEN
    RAISE EXCEPTION 'Disposable local atlas superuser fixture required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tenants) OR
     EXISTS (SELECT 1 FROM public.tenant_domains) OR
     EXISTS (SELECT 1 FROM public.tenant_usage_events) THEN
    RAISE EXCEPTION 'Fixture source is not empty';
  END IF;
END;
$guard$;

INSERT INTO public.tenants (id,slug,display_name,state,created_at,updated_at) VALUES
 ('11111111-1111-4111-8111-111111111111','restore-fixture-alpha','Synthetic Restore Alpha','ACTIVE','2026-09-26T00:00:00Z','2026-09-26T00:00:00Z'),
 ('22222222-2222-4222-8222-222222222222','restore-fixture-beta','Synthetic Restore Beta','ACTIVE','2026-09-26T00:00:00Z','2026-09-26T00:00:00Z');
INSERT INTO public.tenant_domains (id,tenant_id,hostname,type,status,is_primary,created_at,updated_at) VALUES
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','restore-alpha.example.test','custom','PENDING',true,'2026-09-26T00:00:00Z','2026-09-26T00:00:00Z'),
 ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','restore-beta.example.test','custom','PENDING',true,'2026-09-26T00:00:00Z','2026-09-26T00:00:00Z');
INSERT INTO public.tenant_usage_events (id,tenant_id,period_start,requests,duration_ms,emails,created_at,processed_at) VALUES
 ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','2026-09-01',3,111.5,1,'2026-09-26T00:00:00Z','2026-09-26T00:00:00Z'),
 ('66666666-6666-4666-8666-666666666666','22222222-2222-4222-8222-222222222222','2026-09-01',7,222.5,2,'2026-09-26T00:00:00Z','2026-09-26T00:00:00Z');

CREATE SCHEMA atlas_restore_fixture AUTHORIZATION atlas;
CREATE SEQUENCE atlas_restore_fixture.uncalled_sequence;
DO $sequence$
BEGIN
  PERFORM setval('atlas_restore_fixture.uncalled_sequence', 42, false);
END;
$sequence$;
SELECT json_build_object(
 'tenants',(SELECT count(*) FROM public.tenants),
 'tenant_domains',(SELECT count(*) FROM public.tenant_domains),
 'tenant_usage_events',(SELECT count(*) FROM public.tenant_usage_events),
 'sequence',(SELECT json_build_object('last_value',last_value::text,'is_called',is_called) FROM atlas_restore_fixture.uncalled_sequence)
);
COMMIT;
`;
  phase = "seed";
  const output = execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-q",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      dbUser,
      "-d",
      sourceDb,
      "-A",
      "-t",
      "-f",
      "-",
    ],
    {
      input: sql,
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 64 * 1024,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  const result = JSON.parse(output);
  if (
    result.tenants !== 2 ||
    result.tenant_domains !== 2 ||
    result.tenant_usage_events !== 2 ||
    result.sequence?.last_value !== "42" ||
    result.sequence?.is_called !== false
  )
    throw new Error("Fixture verification failed");
  console.log(
    JSON.stringify(
      {
        ok: true,
        evidenceScope: "disposable-local-synthetic-restore-fixture",
        sourceDatabase: sourceDb,
        rows: { tenants: 2, tenant_domains: 2, tenant_usage_events: 2 },
        sequence: {
          schema: "atlas_restore_fixture",
          name: "uncalled_sequence",
          last_value: "42",
          is_called: false,
        },
        note: "Synthetic data only. This seeds an empty fixture; it does not prove backup or restore success.",
      },
      null,
      2,
    ),
  );
} catch {
  console.log(
    JSON.stringify(
      {
        ok: false,
        phase,
        failure:
          phase === "configuration"
            ? "Require explicit valid RESTORE_DRILL_CONTAINER, RESTORE_DRILL_USER=atlas, RESTORE_DRILL_SOURCE_DB=atlas_lms_ci or atlas_lms_ops_source, and RESTORE_DRILL_SEED_FIXTURE=1."
            : "Fixture seed or verification failed; no automatic retry. Inspect the authorized disposable database before retrying. Provider output is suppressed.",
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
