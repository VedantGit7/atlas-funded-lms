#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const failures = [];
const checks = [];

const rollbackTarget = process.env.RELEASE_SHA?.trim() || process.env.RELEASE_VERSION?.trim();
checks.push({
  name: "rollback.target.present",
  ok: Boolean(rollbackTarget),
  note: rollbackTarget
    ? "present"
    : "set RELEASE_SHA or RELEASE_VERSION before production rollback",
});

const strictProduction = process.argv.includes("--strict-production");
if (strictProduction && !rollbackTarget) {
  failures.push("Set RELEASE_SHA or RELEASE_VERSION to identify immutable rollback target");
}

const runbookPath = join(process.cwd(), "docs/runbooks/rollback.md");
const runbookExists = existsSync(runbookPath);
checks.push({ name: "rollback.runbook.present", ok: runbookExists });
if (!runbookExists) {
  failures.push("Missing docs/runbooks/rollback.md");
} else {
  const runbook = readFileSync(runbookPath, "utf8");
  const hasIncidentGuidance =
    runbook.includes("rollbackTarget") && runbook.includes("release:health");
  checks.push({ name: "rollback.runbook.content", ok: hasIncidentGuidance });
  if (!hasIncidentGuidance) {
    failures.push("Rollback runbook missing release health verification steps");
  }
}

const incidentRunbook = join(process.cwd(), "docs/runbooks/incident-triage.md");
checks.push({
  name: "incident.runbook.present",
  ok: existsSync(incidentRunbook),
});
if (!existsSync(incidentRunbook)) {
  failures.push("Missing docs/runbooks/incident-triage.md");
}

const releaseOwner = process.env.RELEASE_OWNER?.trim();
const incidentOwner = process.env.INCIDENT_OWNER?.trim();

checks.push({
  name: "release.owner.documented",
  ok: Boolean(releaseOwner),
  note: releaseOwner ? "present" : "set RELEASE_OWNER before production rollback",
});
checks.push({
  name: "incident.owner.documented",
  ok: Boolean(incidentOwner),
  note: incidentOwner ? "present" : "set INCIDENT_OWNER before production rollback",
});

if (strictProduction) {
  if (!releaseOwner) {
    failures.push("RELEASE_OWNER not set (required for production rollback verification)");
  }
  if (!incidentOwner) {
    failures.push("INCIDENT_OWNER not set (required for production rollback verification)");
  }
}

const result = {
  ok: failures.length === 0,
  rollbackTarget: rollbackTarget ?? null,
  checks,
  failures,
  note: "Verification only — does not perform automatic production rollback",
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
