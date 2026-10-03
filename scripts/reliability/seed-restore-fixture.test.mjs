import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

// Execute the real CLI while replacing only child_process.execFileSync.
// No Docker, PostgreSQL, provider, credential file or network access occurs.
const preload = `
import child from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { writeFileSync } from 'node:fs';
const calls=[];
process.on('exit',()=>writeFileSync(process.env.SEED_TRACE,JSON.stringify(calls)));
child.execFileSync=(file,args,options)=>{
  if(file!=='docker') throw new Error('Unexpected process');
  calls.push({file,args,options});
  if(process.env.SEED_CASE==='database-refused') throw new Error('secret-provider-detail existing tenants');
  if(process.env.SEED_CASE==='timeout') throw Object.assign(new Error('secret-provider-detail'),{code:'ETIMEDOUT'});
  if(process.env.SEED_CASE==='invalid-output') return 'secret-provider-detail';
  if(process.env.SEED_CASE==='wrong-count') return JSON.stringify({tenants:1,tenant_domains:2,tenant_usage_events:2,sequence:{last_value:'42',is_called:false}});
  return JSON.stringify({tenants:2,tenant_domains:2,tenant_usage_events:2,sequence:{last_value:'42',is_called:false}});
};
syncBuiltinESMExports();
`;

function run(mode = "normal", overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), "atlas-seed-boundary-"));
  const loader = join(dir, "fake-docker.mjs");
  const trace = join(dir, "trace.json");
  writeFileSync(loader, preload);
  try {
    const child = spawnSync(
      process.execPath,
      ["--import", pathToFileURL(loader).href, "scripts/reliability/seed-restore-fixture.mjs"],
      {
        cwd: resolve(import.meta.dirname, "../.."),
        encoding: "utf8",
        timeout: 5000,
        env: {
          ...process.env,
          RESTORE_DRILL_CONTAINER: "atlas-disposable-fixture",
          RESTORE_DRILL_USER: "atlas",
          RESTORE_DRILL_SOURCE_DB: "atlas_lms_ops_source",
          RESTORE_DRILL_SEED_FIXTURE: "1",
          SEED_TRACE: trace,
          SEED_CASE: mode,
          ...overrides,
        },
      },
    );
    assert.equal(child.error, undefined);
    return {
      status: child.status,
      output: child.stdout + child.stderr,
      report: JSON.parse(child.stdout),
      calls: existsSync(trace) ? JSON.parse(readFileSync(trace, "utf8")) : [],
    };
  } finally {
    for (const file of [loader, trace]) if (existsSync(file)) rmSync(file);
    rmdirSync(dir);
  }
}

test("refuses missing consent or explicit container/user/source before calling Docker", () => {
  for (const key of [
    "RESTORE_DRILL_CONTAINER",
    "RESTORE_DRILL_USER",
    "RESTORE_DRILL_SOURCE_DB",
    "RESTORE_DRILL_SEED_FIXTURE",
  ]) {
    const result = run("normal", { [key]: "" });
    assert.equal(result.status, 1);
    assert.deepEqual(result.calls, []);
  }
});

test("rejects non-fixture source names, non-atlas users and unsafe container input", () => {
  for (const overrides of [
    { RESTORE_DRILL_SOURCE_DB: "atlas_lms_dev" },
    { RESTORE_DRILL_SOURCE_DB: "atlas_lms_production" },
    { RESTORE_DRILL_SOURCE_DB: "atlas_lms_ci;drop database postgres" },
    { RESTORE_DRILL_USER: "postgres" },
    { RESTORE_DRILL_CONTAINER: "--host=remote" },
    { RESTORE_DRILL_CONTAINER: "fixture;echo secret" },
    { RESTORE_DRILL_SEED_FIXTURE: "true" },
  ]) {
    const result = run("normal", overrides);
    assert.equal(result.status, 1);
    assert.deepEqual(result.calls, []);
  }
});

test("only the two disposable names can reach a single bounded shell-free Docker command", () => {
  for (const db of ["atlas_lms_ci", "atlas_lms_ops_source"]) {
    const result = run("normal", { RESTORE_DRILL_SOURCE_DB: db });
    assert.equal(result.status, 0);
    assert.equal(result.report.ok, true);
    assert.equal(result.calls.length, 1);
    const { args, options } = result.calls[0];
    assert.deepEqual(args, [
      "exec",
      "-i",
      "atlas-disposable-fixture",
      "psql",
      "-X",
      "-q",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "atlas",
      "-d",
      db,
      "-A",
      "-t",
      "-f",
      "-",
    ]);
    assert.equal(options.shell, false);
    assert.equal(options.timeout, 30000);
    assert.ok(options.maxBuffer <= 65536);
    const sql = options.input;
    assert.equal((sql.match(/BEGIN;/g) ?? []).length, 1);
    assert.equal((sql.match(/COMMIT;/g) ?? []).length, 1);
    assert.match(sql, /SET LOCAL statement_timeout\s*=\s*'10s'/);
    assert.match(
      sql,
      /LOCK TABLE public\.tenants, public\.tenant_domains, public\.tenant_usage_events IN SHARE ROW EXCLUSIVE MODE/,
    );
    assert.ok(
      sql.indexOf("EXISTS (SELECT 1 FROM public.tenants)") <
        sql.indexOf("INSERT INTO public.tenants"),
    );
    assert.match(sql, /current_user <> 'atlas'/);
    assert.match(sql, /rolsuper/);
    assert.match(sql, /current_database\(\) NOT IN \('atlas_lms_ci', 'atlas_lms_ops_source'\)/);
    assert.match(sql, /CREATE SCHEMA atlas_restore_fixture/);
    assert.match(sql, /setval\('atlas_restore_fixture\.uncalled_sequence', 42, false\)/);
    assert.equal((sql.match(/\.example\.test/g) ?? []).length, 2);
    assert.ok(!/DROP |TRUNCATE |DELETE FROM|IF NOT EXISTS/.test(sql));
    assert.deepEqual(result.report.rows, { tenants: 2, tenant_domains: 2, tenant_usage_events: 2 });
  }
});

for (const mode of ["database-refused", "timeout", "invalid-output", "wrong-count"]) {
  test(`database boundary ${mode} fails safely without retries or output disclosure`, () => {
    const result = run(mode);
    assert.equal(result.status, 1);
    assert.equal(result.report.ok, false);
    assert.equal(result.calls.length, 1);
    assert.ok(!result.output.includes("secret-provider-detail"));
  });
}
