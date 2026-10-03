import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

// Substitute only the Docker boundary; execute the actual CLI and control flow.
const preload = `
import child from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { writeFileSync } from 'node:fs';
const calls=[]; let marker=''; let dumped=false;
process.on('exit',()=>writeFileSync(process.env.DRILL_TRACE,JSON.stringify(calls)));
child.execFileSync=(file,args)=>{
  if(file!=='docker') throw new Error('Unexpected process');
  calls.push(args); const sql=args.at(-1); const mode=process.env.DRILL_CASE;
  if(args.includes('pg_dump')) {
    if(args.includes('--schema-only')) return mode==='schema-mismatch'&&args.includes(process.env.RESTORE_DRILL_TARGET_DB)?'CREATE TABLE fixture(id bigint);':'CREATE TABLE fixture(id int);';
    dumped=true; return ' ';
  }
  if(args.includes('pg_restore')) {
    if(mode==='restore-error') throw Object.assign(new Error('restore error'),{stderr:'ERROR: missing constraint',stdout:''});
    return '';
  }
  if(args.includes('stat')) return '128';
  if(args.includes('psql')) {
    if(sql.includes('restore-drill:exists')) return mode==='collision'?'1':'0';
    if(sql.includes('COMMENT ON DATABASE')) {marker=sql.match(/IS '([^']+)'/)[1];return '';}
    if(sql.includes('restore-drill:ownership')) return mode==='marker-mismatch'?'owned-by-another-run':marker;
    if(sql.includes('DROP DATABASE')&&mode==='cleanup-failure') throw new Error('target still in use');
    if(sql.includes('restore-drill:tables')) return JSON.stringify(['tenants','tenant_domains','tenant_usage_events'].map(name=>({schema:'public',name})));
    if(sql.includes('restore-drill:rows')) {
      const changed=(mode==='data-loss'&&args.includes(process.env.RESTORE_DRILL_TARGET_DB))||(mode==='source-mutation'&&dumped&&args.includes(process.env.RESTORE_DRILL_SOURCE_DB));
      return Array.from({length:sql.split('restore-drill:rows').length-1},()=>JSON.stringify({rows:mode==='empty-data'?0:2,digest:changed?'different':'same'})).join('\\n');
    }
    if(sql.includes('restore-drill:sequences')) return JSON.stringify([{schemaname:'public',sequencename:'fixture_seq',sequenceowner:'atlas',start_value:'1',last_value:null}]);
    if(sql.includes('restore-drill:sequence-state')) return JSON.stringify({last_value:mode==='sequence-mismatch'&&args.includes(process.env.RESTORE_DRILL_TARGET_DB)?'1':'42',is_called:false});
    if(sql.includes('restore-drill:security')) return JSON.stringify({tenantTables:1,unprotected:0,policies:1,tenantFunction:1});
    if(sql.includes('pg_policy')||sql.includes('pg_proc')) return '1';
    return '0';
  }
  return '';
};
syncBuiltinESMExports();
`;

function run(mode, overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), "atlas-restore-boundary-"));
  const loader = join(dir, "fake-docker.mjs");
  const trace = join(dir, "trace.json");
  const report = join(dir, "report.json");
  writeFileSync(loader, preload);
  try {
    const result = spawnSync(
      process.execPath,
      ["--import", pathToFileURL(loader).href, "scripts/release/restore-drill.mjs"],
      {
        cwd: resolve(import.meta.dirname, "../.."),
        encoding: "utf8",
        timeout: 15_000,
        env: {
          ...process.env,
          RESTORE_DRILL_CONTAINER: "disposable-fixture",
          RESTORE_DRILL_SOURCE_DB: "atlas_lms_test",
          RESTORE_DRILL_TARGET_DB: "atlas_restore_drill_0123456789abcdef0123456789abcdef",
          RESTORE_DRILL_USER: "atlas",
          RESTORE_DRILL_QUIESCED: "1",
          RESTORE_DRILL_OUT: report,
          DRILL_TRACE: trace,
          DRILL_CASE: mode,
          ...overrides,
        },
      },
    );
    assert.equal(result.error, undefined);
    return {
      status: result.status,
      calls: existsSync(trace) ? JSON.parse(readFileSync(trace, "utf8")) : [],
      report: existsSync(report) ? JSON.parse(readFileSync(report, "utf8")) : null,
    };
  } finally {
    for (const file of [loader, trace, report]) if (existsSync(file)) rmSync(file);
    rmdirSync(dir);
  }
}

test("requires explicit source and quiescence without invoking Docker", () => {
  for (const overrides of [{ RESTORE_DRILL_SOURCE_DB: "" }, { RESTORE_DRILL_QUIESCED: "" }]) {
    const result = run("normal", overrides);
    assert.notEqual(result.status, 0);
    assert.deepEqual(result.calls, []);
  }
});
test("refuses an empty application dataset before dumping or creating a target", () => {
  const result = run("empty-data");
  assert.notEqual(result.status, 0);
  assert.equal(result.report?.checks?.applicationDataPresent, false);
  assert.equal(
    result.calls.some(
      (args) => args.includes("pg_restore") || /CREATE DATABASE/i.test(args.at(-1)),
    ),
    false,
  );
});
test("refuses source equal to target before any database command", () => {
  const result = run("normal", {
    RESTORE_DRILL_SOURCE_DB: "atlas_restore_drill_0123456789abcdef0123456789abcdef",
  });
  assert.notEqual(result.status, 0);
  assert.deepEqual(result.calls, []);
});
test("never drops or replaces an existing scratch database", () => {
  const result = run("collision");
  assert.notEqual(result.status, 0);
  assert.equal(
    result.calls.some((args) => /(?:drop|create) database/i.test(args.at(-1))),
    false,
  );
});
test("treats any pg_restore failure as failed and cleans only its owned target", () => {
  const result = run("restore-error");
  assert.notEqual(result.status, 0);
  assert.equal(result.report?.ok, false);
  assert.equal(result.calls.filter((args) => /drop database/i.test(args.at(-1))).length, 1);
});
test("detects changed restored data even when row counts match", () => {
  const result = run("data-loss");
  assert.notEqual(result.status, 0);
  assert.equal(result.report?.ok, false);
});
test("successful verification records local-only scope and owned cleanup", () => {
  const result = run("normal");
  assert.equal(result.status, 0);
  assert.equal(result.report?.ok, true);
  assert.equal(result.report?.productionDrill, false);
  assert.equal(result.report?.cleanupComplete, true);
  assert.equal(result.calls.filter((args) => /drop database/i.test(args.at(-1))).length, 1);
});

test("refuses to drop a target whose ownership marker no longer matches", () => {
  const result = run("marker-mismatch");
  assert.notEqual(result.status, 0);
  assert.equal(result.report?.ok, false);
  assert.equal(result.report?.cleanupComplete, false);
  assert.equal(
    result.calls.some((args) => /drop database/i.test(args.at(-1))),
    false,
  );
  assert.match(result.report?.failures.join(" "), /ownership/i);
  assert.equal(
    result.calls.some((args) => args.includes("rm")),
    true,
  );
});

test("source mutation after the dump prevents target creation and restore", () => {
  const result = run("source-mutation");
  assert.notEqual(result.status, 0);
  assert.equal(result.report?.checks.sourceUnchanged, false);
  assert.equal(result.report?.cleanupComplete, true);
  assert.equal(
    result.calls.some((args) => /create database/i.test(args.at(-1))),
    false,
  );
  assert.equal(
    result.calls.some((args) => args.includes("pg_restore")),
    false,
  );
  assert.equal(
    result.calls.some((args) => args.includes("rm")),
    true,
  );
});

test("target cleanup failure prevents success after matching restoration", () => {
  const result = run("cleanup-failure");
  assert.notEqual(result.status, 0);
  assert.equal(result.report?.checks.tableContentsMatch, true);
  assert.equal(result.report?.ok, false);
  assert.equal(result.report?.cleanupComplete, false);
  assert.equal(result.calls.filter((args) => /drop database/i.test(args.at(-1))).length, 1);
  assert.equal(
    result.calls.some((args) => args.includes("rm")),
    true,
  );
});

test("detects wrong uncalled sequence value despite identical pg_sequences last_value", () => {
  const result = run("sequence-mismatch");
  assert.notEqual(result.status, 0);
  assert.equal(result.report?.checks.tableContentsMatch, true);
  assert.equal(result.report?.checks.sequencesMatch, false);
  assert.equal(result.report?.ok, false);
  assert.equal(result.report?.cleanupComplete, true);
  assert.equal(
    result.calls.some((args) => /\bnextval\s*\(/i.test(args.at(-1))),
    false,
  );
});

test("schema definition drift prevents success even when rows and sequences match", () => {
  const result = run("schema-mismatch");
  assert.notEqual(result.status, 0);
  assert.equal(result.report?.checks.tableContentsMatch, true);
  assert.equal(result.report?.checks.sequencesMatch, true);
  assert.equal(result.report?.checks.schemaOwnershipGrantsMatch, false);
  assert.equal(result.report?.ok, false);
  assert.equal(result.report?.cleanupComplete, true);
});
