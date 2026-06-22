import type { ReleaseGateResult } from "./schema.js";

export const MANUAL_GATE_IDS = [
  "legal_readiness",
  "monitoring_alerts",
  "backup_restore_drill",
  "rollback_target",
  "domain_ssl",
  "production_secrets_review",
  "incident_owner",
  "cto_approval",
] as const;

export type ManualGateId = (typeof MANUAL_GATE_IDS)[number];

export const AUTOMATED_GATE_DEFINITIONS = [
  { id: "format_check", name: "Format check", severity: "P0" as const },
  { id: "lint", name: "Lint", severity: "P0" as const },
  { id: "typecheck", name: "Typecheck", severity: "P0" as const },
  { id: "route_metadata", name: "Route metadata", severity: "P0" as const },
  { id: "zod_boundaries", name: "Zod API boundaries", severity: "P0" as const },
  { id: "permission_metadata", name: "Permission metadata", severity: "P0" as const },
  { id: "entitlement_metadata", name: "Entitlement metadata", severity: "P1" as const },
  { id: "prisma_boundary", name: "Prisma import boundary", severity: "P0" as const },
  { id: "audit_metadata", name: "Audit obligations", severity: "P0" as const },
  { id: "outbox_metadata", name: "Outbox obligations", severity: "P0" as const },
  { id: "forbidden_scope", name: "Forbidden product scope", severity: "P0" as const },
  {
    id: "tenant_resource_registry",
    name: "Tenant resource IDOR registry",
    severity: "P0" as const,
  },
  { id: "security_check", name: "Security regression bundle", severity: "P0" as const },
  { id: "unit_tests", name: "Unit tests", severity: "P0" as const },
  { id: "integration_tests", name: "Integration tests", severity: "P0" as const },
  { id: "authorization_tests", name: "Authorization matrix", severity: "P0" as const },
  { id: "tenant_isolation_tests", name: "Tenant isolation", severity: "P0" as const },
  { id: "rls_tests", name: "RLS state check", severity: "P0" as const },
  { id: "worker_tests", name: "Worker/event pipeline", severity: "P1" as const },
  { id: "storage_tests", name: "Storage policy", severity: "P1" as const },
  { id: "e2e_tests", name: "E2E wiring suite", severity: "P0" as const },
  { id: "tenant_config_validate", name: "Tenant config manifests", severity: "P0" as const },
  { id: "db_migrate_check", name: "Migration status", severity: "P0" as const },
  { id: "db_rls_check", name: "RLS policies", severity: "P0" as const },
  { id: "db_seed_check", name: "Seed/config check", severity: "P1" as const },
  { id: "build", name: "Production build", severity: "P0" as const },
  { id: "observability_contract", name: "Observability contract", severity: "P1" as const },
  { id: "release_health", name: "Staging release health", severity: "P1" as const },
  { id: "restore_validation", name: "Restored environment validation", severity: "P1" as const },
] as const;

export function createManualGateResults(): ReleaseGateResult[] {
  return MANUAL_GATE_IDS.map((id) => ({
    id,
    name: id.replaceAll("_", " "),
    kind: "manual" as const,
    severity: "P0" as const,
    status: "manual_required" as const,
    message: "Requires human sign-off before production review",
  }));
}

export function isLaunchCriticalP1(gate: ReleaseGateResult): boolean {
  return gate.severity === "P1" && gate.status === "failed";
}

export function isP0Blocker(gate: ReleaseGateResult): boolean {
  return gate.severity === "P0" && (gate.status === "failed" || gate.status === "manual_required");
}
