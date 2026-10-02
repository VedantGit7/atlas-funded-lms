import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { test } from "node:test";

const repository = resolve(import.meta.dirname, "../..");
const sentinel = "private-fixture-value-do-not-publish";

function runFixture(t, mode = "valid") {
  const parent = resolve(tmpdir());
  const root = mkdtempSync(join(parent, "atlas-probe-evidence-"));
  t.after(() => {
    assert.ok(root.startsWith(`${parent}${sep}`));
    rmSync(root, { recursive: true, force: true });
  });
  const put = (file, content) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  };
  for (const file of ["verify-failure-probes.mjs", "isolated-target.mjs"]) {
    mkdirSync(join(root, "scripts/e2e"), { recursive: true });
    copyFileSync(join(repository, "scripts/e2e", file), join(root, "scripts/e2e", file));
  }
  put("fixture.json", JSON.stringify({ mode, sentinel }));
  put(
    "scripts/e2e/seed-browser-scenarios.mjs",
    `
    import { readFileSync } from 'node:fs';
    const { mode } = JSON.parse(readFileSync('fixture.json'));
    if (JSON.parse(readFileSync('.test-results/f16-probes/evidence.json')).current.stage !== 'seed') process.exit(99);
    process.exit(mode === 'seed-error' ? 2 : 0);
  `,
  );
  put(
    "node_modules/@playwright/test/cli.js",
    `
    const fs = require('node:fs');
    const { mode, sentinel } = JSON.parse(fs.readFileSync('fixture.json'));
    const fault = process.env.E2E_FAILURE_PROBE;
    const target = mode === 'grading-diagnostics' ? fault === 'wrong-grade' : mode === 'phase-diagnostics' ? fault === 'completion-not-saved' : fault === 'entitlement-not-saved';
    const observed = JSON.parse(fs.readFileSync('.test-results/f16-probes/evidence.json'));
    if (observed.current.stage !== 'spawn') process.exit(99);
    fs.appendFileSync('observed.jsonl', JSON.stringify(observed) + '\\n');
    const messages = {
      'completion-not-saved': 'Lesson completed', 'wrong-grade': 'scorePercent',
      'role-not-revoked': 'Revoked role', 'review-skipped': 'REVIEW',
      'review-return-not-saved': 'Returned course must leave the review queue',
      'entitlement-not-saved': 'enabled', 'foreign-read-allowed': '404'
    };
    if (target && mode === 'missing-report') process.exit(1);
    if (target && mode === 'malformed-report') {
      fs.writeFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_FILE, '{' + sentinel);
      process.exit(1);
    }
    if (target && mode === 'spawn-error') {
      fs.writeSync(1, Buffer.alloc(2 * 1024 * 1024, 'x'));
      process.exit(1);
    }
    if (target && mode === 'server-failures') {
      fs.writeSync(1, '[WebServer] ' + JSON.stringify({message:'route.failure',route:'/api/v1/public/auth/login',errorCode:'AUTH_REQUIRED',errorMessage:sentinel}) + '\\n');
      fs.writeSync(1, '[WebServer] ' + JSON.stringify({message:'route.failure',route:'/api/v1/courses/4dc3529d-eb9a-47ce-a333-3dff75ab4c87/' + sentinel,errorCode:sentinel}) + '\\n');
      fs.writeSync(2, '[WebServer] {"message":"route.failure",' + sentinel + '\\n');
      fs.writeSync(1, '[WebServer] ' + JSON.stringify({message:sentinel,route:'/api/v1/courses',errorCode:'AUTH_REQUIRED'}) + ' route.failure\\n');
    }
    const file = 'tests/browser/journeys/10-platform-provision-entitlements.spec.ts';
    const error = {
      message: (target && ['wrong-assertion', 'stack-only', 'malformed-location', 'server-failures'].includes(mode) ? 'other assertion' : messages[fault]) + sentinel,
      stack: sentinel + '\\n at ' + file + ':118:42\\n at ' + sentinel + ':2:3',
      location: { file, line: 118, column: 42 },
      snippet: sentinel
    };
    if (target && mode === 'stack-only') {
      delete error.location;
      error.stack = 'at check (/repo/' + file + ':118:42)\\n at ' + file + ':118:42';
    }
    if (target && mode === 'malformed-location') {
      error.location = { file, line: '118', column: -1 };
      error.stack = 'at /repo/' + file + ':99999999999999999999:42\\n at /private/' + sentinel + ':118:42';
    }
    const report = {
      config: { metadata: { authorization: sentinel } },
      errors: target && mode === 'global-error' ? [error] : [],
      suites: [{ specs: [{ tests: [{
        annotations: target && mode === 'not-applied' ? [] : [{type:'failure-probe', description:fault}],
        results: [{ status: target && mode === 'unexpected-pass' ? 'passed' : target && mode === 'timeout' ? 'timedOut' : 'failed',
          duration: target && mode === 'malformed-location' ? sentinel : 12,
          errors: target && mode === 'global-error' ? [] : [error], stdout: [sentinel], stderr: [sentinel],
          attachments: [{ name: sentinel, body: sentinel, path: sentinel }] }]
      }] }], suites: [] }]
    };
    if (target && mode === 'multiple-results') report.suites[0].specs[0].tests[0].results.push(report.suites[0].specs[0].tests[0].results[0]);
    if (target && mode === 'phase-diagnostics') {
      const test = report.suites[0].specs[0].tests[0];
      test.annotations = [
        {type:'j02-phase-start',description:JSON.stringify({phase:'J02 course after enrollment',startedAt:Date.parse('2026-09-23T00:00:20Z'),secret:sentinel})},
        {type:'j02-phase-start',description:JSON.stringify({phase:'J02 enrollment',startedAt:sentinel})},
        {type:'j02-phase-start',description:sentinel},
        {type:'j02-course-status',description:JSON.stringify({phase:'before',status:200,secret:sentinel})},
        {type:'j02-course-status',description:JSON.stringify({phase:sentinel,status:200})},
        {type:'j02-course-status',description:JSON.stringify({phase:'after',status:999})},
        {type:'j02-course-status',description:sentinel}
      ];
      Object.assign(test.results[0], {status:'timedOut',startTime:'2026-09-23T00:00:00Z',steps:[
        {title:'J02 login',duration:1000},
        {title:sentinel,steps:[{title:'J02 course after enrollment',duration:130000,error:{message:'Test timeout of 150000ms exceeded '+sentinel}}]},
        {title:'J02 enrollment',duration:-1},
        {title:'J02 login',duration:-2},
        {title:'J02 course before enrollment',duration:200,error:{message:sentinel}}
      ]});
    }
    if (target && mode === 'grading-diagnostics') {
      const test = report.suites[0].specs[0].tests[0];
      test.annotations = [
        {type:'j03-phase-start',description:JSON.stringify({phase:'J03 submit',startedAt:Date.parse('2026-09-24T00:00:20Z'),secret:sentinel})},
        {type:'j03-phase-start',description:JSON.stringify({phase:sentinel,startedAt:0})},
        {type:'j03-phase-start',description:sentinel},
        {type:'j03-upstream-status',description:'200'},
        {type:'j03-upstream-status',description:sentinel},
        {type:'j03-upstream-status',description:'999'}
      ];
      Object.assign(test.results[0], {status:'failed',startTime:'2026-09-24T00:00:00Z',steps:[
        {title:'J03 login',duration:1000},
        {title:'J03 submit',duration:30000,error:{message:'Timeout '+sentinel},steps:[
          {title:'J03 intercept upstream',duration:-1},
          {title:sentinel,duration:1}
        ]}
      ],errors:[{message:'Timeout '+sentinel,location:{file:'/repo/tests/browser/helpers/auth.ts',line:65,column:14},
        stack:'at login (/repo/tests/browser/helpers/auth.ts:65:14)\\n at /private/' + sentinel + ':4:5'}]});
    }
    fs.writeFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_FILE, JSON.stringify(report));
    process.exit(target && mode === 'unexpected-pass' ? 0 : 1);
  `,
  );
  const child = spawnSync(process.execPath, ["scripts/e2e/verify-failure-probes.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      E2E_OWNER_DATABASE_URL: "postgresql://127.0.0.1:5432/atlas_lms_ci",
      SUPABASE_URL: "http://127.0.0.1:54321",
      E2E_PRIVATE_CANARY: sentinel,
    },
    encoding: "utf8",
    timeout: 30000,
  });
  assert.equal(child.error, undefined);
  const raw = readFileSync(join(root, ".test-results/f16-probes/evidence.json"), "utf8");
  assert.ok(!raw.includes(sentinel), "published evidence must exclude untrusted data and secrets");
  return { child, evidence: JSON.parse(raw), root };
}

test("persists each detection before starting another probe and completes all seven", (t) => {
  const { child, evidence, root } = runFixture(t);
  assert.equal(child.status, 0, child.stderr);
  assert.equal(evidence.status, "passed");
  assert.equal(evidence.probes.length, 7);
  const snapshots = readFileSync(join(root, "observed.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map(JSON.parse);
  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.probes.length),
    [0, 1, 2, 3, 4, 5, 6],
  );
});

for (const mode of [
  "unexpected-pass",
  "not-applied",
  "wrong-assertion",
  "global-error",
  "timeout",
  "multiple-results",
  "missing-report",
  "malformed-report",
  "spawn-error",
  "stack-only",
  "malformed-location",
]) {
  test(`retains five detections and terminal safe diagnostics for ${mode}`, (t) => {
    const { child, evidence } = runFixture(t, mode);
    assert.notEqual(child.status, 0);
    assert.equal(evidence.status, "failed");
    assert.equal(evidence.probes.length, 5);
    assert.equal(evidence.failure.fault, "entitlement-not-saved");
    assert.equal(evidence.failure.spec, "10-platform-provision-entitlements");
    assert.ok(evidence.generatedAt);
    if (["missing-report", "malformed-report"].includes(mode)) {
      assert.equal(evidence.failure.stage, "report");
      assert.equal(
        evidence.failure.reportStatus,
        mode === "missing-report" ? "missing" : "invalid",
      );
    } else if (mode === "spawn-error") {
      assert.equal(evidence.failure.stage, "spawn");
      assert.equal(evidence.failure.process.errorCode, "ENOBUFS");
    } else {
      assert.equal(evidence.failure.stage, "outcome");
      assert.equal(evidence.failure.applied, mode !== "not-applied");
      assert.equal(
        evidence.failure.intendedAssertionMatched,
        !["wrong-assertion", "global-error", "stack-only", "malformed-location"].includes(mode),
      );
      assert.deepEqual(
        evidence.failure.locations,
        mode === "malformed-location"
          ? []
          : [
              {
                file: "tests/browser/journeys/10-platform-provision-entitlements.spec.ts",
                line: 118,
                column: 42,
              },
            ],
      );
      assert.deepEqual(
        evidence.failure.resultDurationsMs,
        mode === "malformed-location" ? [null] : mode === "multiple-results" ? [12, 12] : [12],
      );
    }
  });
}

test("keeps only the route shape and error code of the probe servers' route failures", (t) => {
  const { child, evidence } = runFixture(t, "server-failures");
  assert.notEqual(child.status, 0);
  assert.equal(evidence.failure.fault, "entitlement-not-saved");
  assert.equal(evidence.failure.stage, "outcome");
  assert.deepEqual(evidence.failure.serverFailures, [
    { route: "/api/v1/public/auth/login", errorCode: "AUTH_REQUIRED" },
    { route: "/api/v1/courses/:param/:param", errorCode: "other" },
  ]);
});

test("seed failure is terminal and never runs a browser", (t) => {
  const { child, evidence } = runFixture(t, "seed-error");
  assert.notEqual(child.status, 0);
  assert.equal(evidence.status, "failed");
  assert.equal(evidence.probes.length, 0);
  assert.equal(evidence.failure.stage, "seed");
  assert.equal(evidence.failure.process.exitCode, 2);
});

test("grading failure retains safe phases, helper coordinates and upstream status without passing", (t) => {
  const { child, evidence } = runFixture(t, "grading-diagnostics");
  assert.notEqual(child.status, 0);
  assert.equal(evidence.probes.length, 1);
  assert.equal(evidence.failure.applied, false);
  assert.equal(evidence.failure.intendedAssertionMatched, false);
  assert.deepEqual(evidence.failure.phaseTimings, [
    {
      phase: "J03 login",
      startOffsetMs: null,
      durationMs: 1000,
      completed: true,
      errorCategory: null,
    },
    {
      phase: "J03 submit",
      startOffsetMs: 20000,
      durationMs: 30000,
      completed: true,
      errorCategory: "timeout",
    },
    {
      phase: "J03 intercept upstream",
      startOffsetMs: null,
      durationMs: null,
      completed: false,
      errorCategory: null,
    },
  ]);
  assert.deepEqual(evidence.failure.upstreamStatuses, [200]);
  assert.deepEqual(evidence.failure.locations, [
    { file: "tests/browser/helpers/auth.ts", line: 65, column: 14 },
  ]);
});

test("retains only bounded known phase timings and valid course status, without accepting a timeout", (t) => {
  const { child, evidence } = runFixture(t, "phase-diagnostics");
  assert.notEqual(child.status, 0);
  assert.equal(evidence.failure.applied, false);
  assert.deepEqual(evidence.failure.phaseTimings, [
    {
      phase: "J02 login",
      startOffsetMs: null,
      durationMs: 1000,
      completed: true,
      errorCategory: null,
    },
    {
      phase: "J02 course after enrollment",
      startOffsetMs: 20000,
      durationMs: 130000,
      completed: true,
      errorCategory: "timeout",
    },
    {
      phase: "J02 enrollment",
      startOffsetMs: null,
      durationMs: null,
      completed: false,
      errorCategory: null,
    },
    {
      phase: "J02 course before enrollment",
      startOffsetMs: null,
      durationMs: 200,
      completed: true,
      errorCategory: "other",
    },
  ]);
  assert.deepEqual(evidence.failure.courseResponses, [{ phase: "before", status: 200 }]);
});
