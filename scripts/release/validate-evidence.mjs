#!/usr/bin/env node

/**
 * Freshness and integrity guard for `release-evidence.json` (audit finding H18).
 *
 * The CI job named `release-evidence-validation` asserted `test -f
 * release-evidence.json` — existence, and nothing else. What that permitted:
 *
 *   - The committed artifact was **8 weeks stale** (generated 2026-06-22) while
 *     three substantial merges had landed since.
 *   - It read `verdict: READY_FOR_STAGING` with **9 of 30 P0 gates skipped**,
 *     among them `integration_tests`, `tenant_isolation_tests`, `rls_tests` and
 *     `db_rls_check` — precisely the guarantees the hardening programme exists
 *     to protect.
 *   - Three gates it reported as `passed` were measurably failing at the time of
 *     the audit.
 *
 * A stale green artifact satisfied every one of those conditions. This asserts
 * what "validation" was supposed to mean:
 *
 *   1. It parses, and has the schema fields the readers depend on.
 *   2. It is fresh — generated within RELEASE_EVIDENCE_MAX_AGE_HOURS (default 24).
 *   3. It describes *this* commit when a commit SHA is available on both sides.
 *   4. No gate failed.
 *   5. No automated P0 gate was skipped, because an unrun gate is an unanswered
 *      question rather than a pass.
 *   6. The recorded verdict is consistent with the gates it lists — so an
 *      artifact that was hand-edited, or produced by an older generator whose
 *      verdict logic was laxer, cannot assert readiness it did not earn.
 *
 * Rule 5 is the one that matters most: it is the exact hole H18 describes, and
 * `run-suite.mjs` now refuses to emit READY_FOR_STAGING under those conditions.
 * This checks the artifact independently, so a stale file generated before that
 * fix cannot slip through.
 */

import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const evidencePath = join(
  repoRoot,
  process.env["RELEASE_EVIDENCE_PATH"] ?? "release-evidence.json",
);
const maxAgeHours = Number(process.env["RELEASE_EVIDENCE_MAX_AGE_HOURS"] ?? "24");

const failures = [];
const notes = [];

function fail(message) {
  failures.push(message);
}

if (!existsSync(evidencePath)) {
  console.error(`\nrelease-evidence.json not found at ${evidencePath}.`);
  console.error("Generate it with `pnpm release:suite`.");
  process.exit(1);
}

let evidence;
try {
  evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
} catch (error) {
  console.error(`\nrelease-evidence.json is not valid JSON: ${error.message}`);
  process.exit(1);
}

/* 1. Shape ---------------------------------------------------------- */

for (const field of ["schemaVersion", "generatedAt", "verdict", "gates"]) {
  if (evidence[field] === undefined) fail(`missing required field \`${field}\``);
}
if (!Array.isArray(evidence.gates)) {
  fail("`gates` is not an array");
}

if (failures.length > 0) {
  console.error("\nRelease evidence is malformed:\n");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

/* 2. Freshness ------------------------------------------------------ */

const generatedAt = new Date(evidence.generatedAt);
if (Number.isNaN(generatedAt.getTime())) {
  fail(`\`generatedAt\` is not a valid date: ${evidence.generatedAt}`);
} else {
  const ageHours = (Date.now() - generatedAt.getTime()) / 3_600_000;
  if (ageHours > maxAgeHours) {
    fail(
      `stale by ${(ageHours / 24).toFixed(1)} days — generated ${evidence.generatedAt}, ` +
        `limit is ${maxAgeHours}h. A point-in-time snapshot vouches only for the tree it ran against.`,
    );
  } else {
    notes.push(`age ${ageHours.toFixed(1)}h (limit ${maxAgeHours}h)`);
  }
}

/* 3. Commit correspondence ------------------------------------------ */

let headSha = process.env["GIT_SHA"] ?? "";
if (!headSha) {
  try {
    headSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    headSha = "";
  }
}
if (evidence.commitSha && headSha) {
  if (evidence.commitSha !== headSha) {
    fail(
      `describes commit ${String(evidence.commitSha).slice(0, 12)} but HEAD is ${headSha.slice(0, 12)}`,
    );
  } else {
    notes.push(`commit ${headSha.slice(0, 12)}`);
  }
} else {
  notes.push("commit correspondence not checked (no commitSha recorded)");
}

/* 4 & 5. Gate outcomes ---------------------------------------------- */

const failed = evidence.gates.filter((g) => g.status === "failed");
if (failed.length > 0) {
  fail(`${failed.length} gate(s) failed: ${failed.map((g) => g.id).join(", ")}`);
}

const skippedP0 = evidence.gates.filter(
  (g) => g.severity === "P0" && g.status === "skipped" && g.kind !== "manual",
);
if (skippedP0.length > 0) {
  fail(
    `${skippedP0.length} automated P0 gate(s) skipped: ${skippedP0.map((g) => g.id).join(", ")}\n` +
      "  An unrun gate is an unanswered question, not a pass.",
  );
}

/* 6. Verdict consistency -------------------------------------------- */

const READY = new Set(["READY_FOR_STAGING", "READY_FOR_PRODUCTION_REVIEW"]);
if (READY.has(evidence.verdict) && (failed.length > 0 || skippedP0.length > 0)) {
  fail(
    `verdict \`${evidence.verdict}\` is not supported by the gates it lists ` +
      `(${failed.length} failed, ${skippedP0.length} P0 skipped)`,
  );
}

if (evidence.productionApproved === true && evidence.verdict !== "READY_FOR_PRODUCTION_REVIEW") {
  fail(`productionApproved is true but verdict is \`${evidence.verdict}\``);
}

/* Report ------------------------------------------------------------ */

const counts = {};
for (const g of evidence.gates) counts[g.status] = (counts[g.status] ?? 0) + 1;

console.log(`Release evidence: ${evidence.gates.length} gates`);
console.log(
  `  ${Object.entries(counts)
    .map(([k, v]) => `${k}: ${v}`)
    .join("  ")}`,
);
console.log(`  verdict: ${evidence.verdict}`);
for (const n of notes) console.log(`  ${n}`);

if (failures.length > 0) {
  console.error("\nRelease evidence validation FAILED:\n");
  for (const f of failures) console.error(`- ${f}`);
  console.error("\nRegenerate with `pnpm release:suite` against the current tree.");
  process.exit(1);
}

console.log("\nRelease evidence validation passed.");
process.exit(0);
