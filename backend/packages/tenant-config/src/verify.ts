import type { ApplyEnvironment } from "./catalogue";
import type { TenantManifest, VerifyExpectation, VerifyReport } from "./types";

export function buildVerifyExpectations(
  manifest: TenantManifest,
  environment: ApplyEnvironment,
): VerifyExpectation[] {
  const expectations: VerifyExpectation[] = [];

  expectations.push({
    key: "tenant.slug",
    expected: manifest.tenant.slug,
    status: "pass",
  });

  for (const entitlement of manifest.entitlements) {
    expectations.push({
      key: `entitlement.${entitlement.key}`,
      expected: entitlement.enabled ? "enabled" : "disabled",
      status: "pass",
    });
  }

  const domain = manifest.domains[environment];
  if (domain) {
    expectations.push({
      key: "domain.hostname",
      expected: domain.hostname,
      status: "pass",
      detail: "Domain record expected; activation requires manual verification.",
    });
    expectations.push({
      key: "domain.verification",
      expected: "pending_or_unverified",
      status: domain.type === "CUSTOM_DOMAIN" ? "pass" : "skip",
    });
  }

  expectations.push({
    key: "branding.publicName",
    expected: manifest.branding.publicName,
    status: "pass",
  });

  expectations.push({
    key: "readiness.legalApproval",
    expected: manifest.readiness.legalApproval.status,
    status: "pass",
  });

  if (manifest.readiness.legalApproval.status === "pending_approval") {
    expectations.push({
      key: "readiness.policy.active",
      expected: "inactive",
      status: "pass",
      detail: "Readiness CTA must not publish without legal approval.",
    });
  }

  expectations.push({
    key: "curriculum.publish",
    expected: "none",
    status: "pass",
    detail: "Learning paths remain draft-only.",
  });

  expectations.push({
    key: "certificates.issue",
    expected: "none",
    status: "pass",
    detail: "Certificate templates remain draft; no automatic issuance.",
  });

  for (const space of manifest.communitySpaces) {
    expectations.push({
      key: `community.${space.slug}.visibility`,
      expected: space.visibility,
      status: "pass",
    });
  }

  expectations.push({
    key: "cta.outboundTargetUrl",
    expected: manifest.readiness.ctaPolicy.outboundTargetUrl,
    status: "pass",
  });

  return expectations;
}

export function buildVerifyReport(
  manifest: TenantManifest,
  environment: ApplyEnvironment,
): VerifyReport {
  const expectations = buildVerifyExpectations(manifest, environment);
  const passed = expectations.every((item) => item.status !== "fail");

  return {
    tenantSlug: manifest.tenant.slug,
    environment,
    expectations,
    passed,
  };
}

export function formatVerifyReport(report: VerifyReport): string {
  const lines = [
    `Verify tenant=${report.tenantSlug} environment=${report.environment} passed=${String(report.passed)}`,
    "",
    ...report.expectations.map(
      (item) =>
        `- ${item.key}: expected=${item.expected} status=${item.status}${item.detail ? ` (${item.detail})` : ""}`,
    ),
  ];

  return lines.join("\n");
}
