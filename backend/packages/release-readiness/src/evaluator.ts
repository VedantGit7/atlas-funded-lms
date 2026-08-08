import type { ReleaseEvidence, ReleaseGateResult, ReleaseVerdict } from "./schema.js";
import {
  AUTOMATED_GATE_DEFINITIONS,
  createManualGateResults,
  isLaunchCriticalP1,
  isP0Blocker,
  MANUAL_GATE_IDS,
} from "./gates.js";

export type EvaluateReleaseEvidenceInput = {
  automatedGates: ReleaseGateResult[];
  branch?: string;
  commitSha?: string;
  environment?: string;
  rollbackTarget?: string | null;
  stagingHealthPassed?: boolean;
  restoredEnvValidated?: boolean;
};

export function evaluateReleaseEvidence(input: EvaluateReleaseEvidenceInput): ReleaseEvidence {
  const manualGates = createManualGateResults();
  const gates = [...input.automatedGates, ...manualGates];

  const blockers: string[] = [];
  const warnings: string[] = [];

  for (const gate of input.automatedGates) {
    if (gate.status === "failed") {
      const label = `${gate.id}: ${gate.message ?? "failed"}`;
      if (gate.severity === "P0") {
        blockers.push(label);
      } else if (isLaunchCriticalP1(gate)) {
        blockers.push(`P1 launch-critical: ${label}`);
      } else {
        warnings.push(label);
      }
    }
  }

  const automatedP0Failures = input.automatedGates.filter(
    (gate) => gate.severity === "P0" && gate.status === "failed",
  );
  const launchCriticalP1Failures = input.automatedGates.filter(isLaunchCriticalP1);

  let verdict: ReleaseVerdict = "NOT_READY";

  if (automatedP0Failures.length === 0 && launchCriticalP1Failures.length === 0) {
    verdict = "READY_FOR_STAGING";
  }

  const stagingReady =
    input.stagingHealthPassed === true &&
    automatedP0Failures.length === 0 &&
    launchCriticalP1Failures.length === 0;

  if (stagingReady) {
    verdict = "READY_FOR_PRODUCTION_REVIEW";
  }

  if (automatedP0Failures.length > 0 || launchCriticalP1Failures.length > 0) {
    verdict = "NOT_READY";
  }

  const manualGatesRequired = MANUAL_GATE_IDS.filter((id) => {
    const gate = manualGates.find((entry) => entry.id === id);
    return gate != null && isP0Blocker(gate);
  });

  return {
    schemaVersion: "1",
    storyId: "ATL-STORY-045",
    generatedAt: new Date().toISOString(),
    branch: input.branch,
    commitSha: input.commitSha,
    environment: input.environment,
    verdict,
    productionApproved: false,
    gates,
    manualGatesRequired: [...manualGatesRequired],
    blockers,
    warnings,
    rollbackTarget: input.rollbackTarget ?? null,
  };
}

export function assertNeverAutoApprovesProduction(evidence: ReleaseEvidence): void {
  if (evidence.productionApproved) {
    throw new Error("Release evidence must never auto-approve production");
  }

  if ((evidence.verdict as string) === "RELEASE_APPROVED") {
    throw new Error("RELEASE_APPROVED is not an allowed automated verdict");
  }
}

export function listAutomatedGateDefinitions() {
  return AUTOMATED_GATE_DEFINITIONS;
}
