export {
  releaseEvidenceSchema,
  releaseGateResultSchema,
  releaseVerdictSchema,
  parseReleaseEvidence,
  safeParseReleaseEvidence,
  type ReleaseEvidence,
  type ReleaseGateResult,
  type ReleaseVerdict,
} from "./schema.js";

export {
  AUTOMATED_GATE_DEFINITIONS,
  MANUAL_GATE_IDS,
  createManualGateResults,
  isLaunchCriticalP1,
  isP0Blocker,
  type ManualGateId,
} from "./gates.js";

export {
  evaluateReleaseEvidence,
  assertNeverAutoApprovesProduction,
  listAutomatedGateDefinitions,
  type EvaluateReleaseEvidenceInput,
} from "./evaluator.js";

export {
  buildTenantResourceRegistry,
  validateTenantResourceRegistryCoverage,
  type TenantResourceRegistryEntry,
  type RegistryCoverageReport,
} from "./tenant-resource-registry.js";
