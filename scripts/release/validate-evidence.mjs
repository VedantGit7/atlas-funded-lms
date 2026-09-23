#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EXPECTED_GATES,
  MANUAL_GATES,
  SCHEMA_VERSION,
  EVIDENCE_TYPE,
  SHA_PATTERN,
  RUN_ID_PATTERN,
  captureSource,
  deriveVerdict,
  gateBlockers,
} from "./evidence-contract.mjs";

const failures = [];
const fail = (message) => failures.push(message);
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const strings = (value) => Array.isArray(value) && value.every((item) => typeof item === "string");
function knownFields(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(`Unknown ${label} field: ${key}`);
  }
}
const maxAgeHours = Number(process.env.RELEASE_EVIDENCE_MAX_AGE_HOURS ?? "24");
if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0)
  fail("RELEASE_EVIDENCE_MAX_AGE_HOURS must be a finite positive number");
let evidence;
try {
  evidence = JSON.parse(
    readFileSync(resolve(process.env.RELEASE_EVIDENCE_PATH ?? "release-evidence.json"), "utf8"),
  );
} catch (error) {
  console.error(`Release evidence cannot be read: ${error.message}`);
  process.exit(1);
}
if (!object(evidence)) {
  console.error("Release evidence must be an object");
  process.exit(1);
}
knownFields(
  evidence,
  [
    "schemaVersion",
    "evidenceType",
    "storyId",
    "generatedAt",
    "branch",
    "commitSha",
    "source",
    "environment",
    "verdict",
    "productionApproved",
    "gates",
    "manualGatesRequired",
    "blockers",
    "warnings",
    "rollbackTarget",
  ],
  "evidence",
);
if (evidence.branch !== undefined && typeof evidence.branch !== "string") fail("Invalid branch");
if (evidence.schemaVersion !== SCHEMA_VERSION)
  fail("Unsupported schemaVersion; regenerate evidence");
if (evidence.evidenceType !== EVIDENCE_TYPE) fail("Invalid evidenceType");
if (evidence.storyId !== "ATL-STORY-045") fail("Invalid storyId");
if (typeof evidence.environment !== "string" || !evidence.environment.trim())
  fail("Missing environment");
if (typeof evidence.commitSha !== "string" || !SHA_PATTERN.test(evidence.commitSha))
  fail("Missing or invalid full commitSha");
if (evidence.productionApproved !== false)
  fail("productionApproved must be false; automated evidence cannot approve production");
if (!["NOT_READY", "READY_FOR_STAGING", "READY_FOR_PRODUCTION_REVIEW"].includes(evidence.verdict))
  fail("Unknown verdict");
for (const field of ["blockers", "warnings", "manualGatesRequired"]) {
  if (!strings(evidence[field])) fail(`${field} must be an array of strings`);
}
if (
  !(
    evidence.rollbackTarget === null ||
    (typeof evidence.rollbackTarget === "string" && evidence.rollbackTarget.trim())
  )
)
  fail("Invalid rollbackTarget");

const timestamp = typeof evidence.generatedAt === "string" ? Date.parse(evidence.generatedAt) : NaN;
if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== evidence.generatedAt)
  fail("generatedAt must be an ISO UTC timestamp");
else {
  const age = Date.now() - timestamp;
  if (age > maxAgeHours * 3_600_000) fail("Release evidence is stale");
  if (age < -5 * 60_000) fail("Release evidence timestamp is in the future");
}
const current = captureSource();
failures.push(...current.errors);
if (evidence.commitSha !== current.source.headSha) fail("commitSha does not match actual HEAD");
if (!object(evidence.source)) fail("Missing source provenance");
else {
  const source = evidence.source;
  knownFields(source, ["headSha", "clean", "ci", "ciRunId", "ciRunAttempt"], "source");
  if (source.headSha !== evidence.commitSha || source.clean !== true)
    fail("Evidence must describe a clean checkout at commitSha");
  if (typeof source.ci !== "boolean") fail("source.ci must be boolean");
  if (source.ci) {
    if (
      typeof source.ciRunId !== "string" ||
      !RUN_ID_PATTERN.test(source.ciRunId) ||
      typeof source.ciRunAttempt !== "string" ||
      !RUN_ID_PATTERN.test(source.ciRunAttempt)
    )
      fail("Missing CI run identity");
  } else if (source.ciRunId !== null || source.ciRunAttempt !== null)
    fail("Local evidence must not claim CI run identity");
  if (
    current.source.ci &&
    (source.ci !== true ||
      source.ciRunId !== current.source.ciRunId ||
      source.ciRunAttempt !== current.source.ciRunAttempt)
  )
    fail("Evidence does not match current CI run and attempt");
}
if (
  strings(evidence.manualGatesRequired) &&
  (evidence.manualGatesRequired.length !== MANUAL_GATES.length ||
    new Set(evidence.manualGatesRequired).size !== MANUAL_GATES.length ||
    MANUAL_GATES.some((id) => !evidence.manualGatesRequired.includes(id)))
)
  fail("manualGatesRequired must contain every expected human sign-off exactly once");

const seen = new Set();
if (!Array.isArray(evidence.gates)) fail("gates must be an array");
else {
  for (const gate of evidence.gates) {
    if (!object(gate)) {
      fail("Invalid gate object");
      continue;
    }
    knownFields(
      gate,
      ["id", "name", "kind", "severity", "status", "command", "message", "durationMs"],
      "gate",
    );
    for (const key of ["command", "message"])
      if (gate[key] !== undefined && typeof gate[key] !== "string") fail(`Invalid gate ${key}`);
    if (gate.durationMs !== undefined && (!Number.isFinite(gate.durationMs) || gate.durationMs < 0))
      fail("Invalid gate durationMs");
    const expected = EXPECTED_GATES.find(({ id }) => id === gate.id);
    if (!expected) {
      fail(`Unknown gate: ${gate.id}`);
      continue;
    }
    if (seen.has(gate.id)) fail(`Duplicate gate: ${gate.id}`);
    seen.add(gate.id);
    if (typeof gate.name !== "string" || !gate.name.trim()) fail(`Missing gate name: ${gate.id}`);
    if (gate.kind !== expected.kind || gate.severity !== expected.severity)
      fail(`Invalid gate kind/severity: ${gate.id}`);
    const statuses =
      expected.kind === "manual" ? ["manual_required"] : ["passed", "failed", "skipped"];
    if (!statuses.includes(gate.status)) fail(`Invalid gate status: ${gate.id}`);
  }
  for (const expected of EXPECTED_GATES)
    if (!seen.has(expected.id)) fail(`Missing gate: ${expected.id}`);
  if (evidence.gates.every(object)) {
    failures.push(...gateBlockers(evidence.gates));
    const derived = deriveVerdict(
      evidence.gates,
      strings(evidence.blockers) ? evidence.blockers : ["malformed blockers"],
    );
    if (evidence.verdict !== derived) fail(`Verdict inconsistent with gates: expected ${derived}`);
  }
}
if (evidence.verdict === "NOT_READY") fail("Release evidence is NOT_READY");
if (Array.isArray(evidence.blockers) && evidence.blockers.length)
  fail("Release evidence contains blockers");
if (failures.length) {
  console.error(
    `Release evidence validation FAILED:\n${failures.map((failure) => `- ${failure}`).join("\n")}`,
  );
  process.exit(1);
}
console.log(
  `Release evidence validation passed: ${evidence.gates.length} gates, ${evidence.verdict}, commit ${evidence.commitSha}`,
);
