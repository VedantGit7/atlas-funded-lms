import type { ApplyEnvironment } from "./catalogue";
import type { ApplyPlan, ApplyPlanStep, TenantManifest } from "./types";

function domainForEnvironment(
  manifest: TenantManifest,
  environment: ApplyEnvironment,
): { hostname: string; type: string } | null {
  const record = manifest.domains[environment];
  if (!record) {
    return null;
  }

  return { hostname: record.hostname, type: record.type };
}

export function buildApplyPlan(
  manifest: TenantManifest,
  environment: ApplyEnvironment,
  options: { productionPlanOnly?: boolean } = {},
): ApplyPlan {
  const steps: ApplyPlanStep[] = [];
  const warnings: string[] = [];
  const mutates = !options.productionPlanOnly && environment !== "production";

  steps.push({
    phase: "provision",
    action: "provisionTenant",
    detail: `Ensure tenant slug ${manifest.tenant.slug} exists via platform provisioning.`,
    mutates,
  });

  steps.push({
    phase: "branding",
    action: "updateTenantBrandingDraft",
    detail: `Apply branding publicName=${manifest.branding.publicName}.`,
    mutates,
  });

  steps.push({
    phase: "theme",
    action: "updateTenantThemeDraft",
    detail: "Apply theme tokens from manifest (draft only).",
    mutates,
  });

  const domain = domainForEnvironment(manifest, environment);
  if (domain) {
    steps.push({
      phase: "domain",
      action: "createTenantDomain",
      detail: `Record domain ${domain.hostname} (${domain.type}); verification remains pending until manual DNS/Vercel steps complete.`,
      mutates,
    });
  } else if (environment === "production" && manifest.domains.production) {
    steps.push({
      phase: "domain",
      action: "createTenantDomain",
      detail: `Production domain ${manifest.domains.production.hostname} is configuration-only in production-plan mode.`,
      mutates: false,
    });
  }

  if (manifest.entitlements.length > 0) {
    steps.push({
      phase: "entitlements",
      action: "grantPlatformTenantEntitlements",
      detail: `Enable ${String(manifest.entitlements.length)} entitlement keys.`,
      mutates,
    });
  }

  if (manifest.featureFlagOverrides.length > 0) {
    steps.push({
      phase: "feature_flags",
      action: "updateTenantFeatureFlagOverride",
      detail: `Apply ${String(manifest.featureFlagOverrides.length)} non-read-only flag overrides.`,
      mutates,
    });
  }

  if (manifest.extensions.length > 0) {
    steps.push({
      phase: "extensions",
      action: "createExtensionRegistration",
      detail: `Register ${String(manifest.extensions.length)} first-party extensions.`,
      mutates,
    });
  } else {
    warnings.push(
      "No extension registrations configured; global catalogue currently exposes item_type_renderer only.",
    );
  }

  steps.push({
    phase: "scoring",
    action: "createCompetencyConfig",
    detail: `Create ${String(manifest.scoring.dimensions.length)} dimensions, scoring profile ${manifest.scoring.profileKey}, and ${String(manifest.scoring.bands.length)} bands (draft; no publish).`,
    mutates,
  });

  if (manifest.readiness.legalApproval.status === "pending_approval") {
    steps.push({
      phase: "readiness",
      action: "skipReadinessPublish",
      detail:
        "Readiness policy remains inactive until legal approval reference is supplied through approved operator workflow.",
      mutates: false,
    });
    warnings.push("Legal copy and CTA publish are gated pending_approval.");
  } else {
    steps.push({
      phase: "readiness",
      action: "updateReadinessPolicy",
      detail:
        "Apply approved readiness policy and CTA configuration (inactive until publish workflow).",
      mutates,
    });
  }

  if (manifest.learningPaths.length > 0) {
    steps.push({
      phase: "curriculum",
      action: "createLearningPathDraft",
      detail: `Create ${String(manifest.learningPaths.length)} draft learning paths.`,
      mutates,
    });
  }

  if (manifest.certificateTemplates.length > 0) {
    steps.push({
      phase: "certificates",
      action: "createCertificateTemplate",
      detail: `Create ${String(manifest.certificateTemplates.length)} draft certificate templates.`,
      mutates,
    });
  }

  if (manifest.gamification.badges.length > 0) {
    steps.push({
      phase: "gamification",
      action: "createBadge",
      detail: `Create ${String(manifest.gamification.badges.length)} draft badges.`,
      mutates,
    });
  }

  if (manifest.communitySpaces.length > 0) {
    steps.push({
      phase: "community",
      action: "createSpace",
      detail: `Create ${String(manifest.communitySpaces.length)} members-only community spaces.`,
      mutates,
    });
  }

  steps.push({
    phase: "locale",
    action: "recordLocale",
    detail: `Launch locale ${manifest.locale.code} recorded in tenant config projection.`,
    mutates,
  });

  steps.push({
    phase: "tenant_config",
    action: "updateTenantConfigDraft",
    detail: "Merge manifest tenantConfigJson into tenant_config draft (no publish).",
    mutates,
  });

  steps.push({
    phase: "verify",
    action: "verifySafeProjection",
    detail:
      "Verify entitlements, branding draft, domain pending state, and no published curriculum.",
    mutates: false,
  });

  if (options.productionPlanOnly || environment === "production") {
    warnings.push(
      "Production apply is refused by default. Execute manual Platform Console/runbook steps only.",
    );
  }

  return {
    tenantSlug: manifest.tenant.slug,
    environment,
    manifestVersion: manifest.manifestVersion,
    steps,
    warnings,
  };
}

export function formatApplyPlan(plan: ApplyPlan): string {
  const lines = [
    `Tenant: ${plan.tenantSlug}`,
    `Environment: ${plan.environment}`,
    `Manifest version: ${plan.manifestVersion}`,
    "",
    "Steps:",
    ...plan.steps.map(
      (step, index) =>
        `${String(index + 1)}. [${step.phase}] ${step.action} — ${step.detail} (mutates=${String(step.mutates)})`,
    ),
  ];

  if (plan.warnings.length > 0) {
    lines.push("", "Warnings:", ...plan.warnings.map((warning) => `- ${warning}`));
  }

  return lines.join("\n");
}
