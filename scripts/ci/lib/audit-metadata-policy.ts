import type { AuditExemption } from "../../../backend/packages/api/src/route-metadata";
import {
  MUTATIONS,
  isPlatformRoute,
  isPublicRoute,
  relativeFile,
  type RouteBinding,
} from "./route-metadata-bindings";

/**
 * The audit-metadata rules (audit M7), as a pure function of the route
 * bindings so they can be tested without the route tree. Run by
 * scripts/ci/check-sensitive-route-audit.ts.
 */

export const SENSITIVE_PERMISSION_PREFIXES = [
  "membership.invite",
  "membership.suspend",
  "membership.remove",
  "role.",
  "permission_override.",
  "branding.update",
  "branding.publish",
  "tenancy.domain.manage",
  "course.publish",
  "workflow.definition.manage",
  "workflow.transition.act",
  "certificate.issue",
  "certificate.revoke",
  "moderation.",
  "data.export",
  "data.deletion",
  "payment",
  "payout",
  "refund",
  "config.",
  "platform.",
] as const;

const AUDIT_EXEMPTIONS = [
  "learner_activity",
  "member_content",
  "own_preferences",
  "read_only",
  "client_telemetry",
] as const satisfies readonly AuditExemption[];

/**
 * Mutating routes with no route metadata, and why they need none. Each is
 * authenticated by a shared secret or a gateway signature rather than a member
 * session, and records its own outcome.
 */
export const NON_METADATA_MUTATIONS: Record<string, string> = {
  "POST /api/v1/internal/certificates/expire": "operator job behind CRON_SECRET (M5)",
  "POST /api/v1/internal/fx/refresh": "operator job behind CRON_SECRET (M5)",
  "POST /api/v1/internal/reports/tick": "operator job behind CRON_SECRET (M5)",
  "POST /api/v1/payments/webhooks/razorpay":
    "signature-verified gateway webhook; fulfilment writes its own audit entries",
  "POST /api/v1/payments/webhooks/stripe":
    "signature-verified gateway webhook; fulfilment writes its own audit entries",
  "POST /api/v1/zoom/webhooks": "signature-verified provider webhook",
};

const isSensitive = (permission: string) =>
  SENSITIVE_PERMISSION_PREFIXES.some((prefix) => permission.startsWith(prefix));

const where = (binding: RouteBinding) =>
  `${binding.method} ${binding.route} (${binding.definedAt ?? relativeFile(binding.file)})`;

export function auditMetadataViolations(
  all: RouteBinding[],
  nonMetadataMutations: Record<string, string> = NON_METADATA_MUTATIONS,
): string[] {
  const mutations = all.filter((binding) => MUTATIONS.has(binding.method));
  const violations: string[] = [];

  for (const binding of mutations) {
    if (isPublicRoute(binding.route)) continue;
    const key = `${binding.method} ${binding.route}`;
    const metadata = binding.metadata;

    if (!metadata?.["permission"]) {
      if (!(key in nonMetadataMutations)) {
        violations.push(`${where(binding)}: mutation whose route metadata could not be resolved`);
      }
      continue;
    }

    const permission = metadata["permission"];
    const audit = metadata["audit"];
    const exemption = metadata["auditExempt"];

    if (isPlatformRoute(binding.route)) {
      if (audit !== "required" && audit !== "platform_scope") {
        violations.push(
          `${where(binding)}: platform mutation must declare audit "required" or "platform_scope"`,
        );
      }
      continue;
    }

    if (audit === "required") {
      if (exemption) {
        violations.push(`${where(binding)}: declares audit "required" and auditExempt; pick one`);
      }
      continue;
    }

    if (audit !== "none") {
      violations.push(`${where(binding)}: unknown audit mode ${JSON.stringify(audit)}`);
      continue;
    }

    if (!exemption) {
      violations.push(
        `${where(binding)}: ${permission} mutation declares audit "none" with no auditExempt reason`,
      );
    } else if (!(AUDIT_EXEMPTIONS as readonly string[]).includes(exemption)) {
      violations.push(`${where(binding)}: unknown auditExempt ${JSON.stringify(exemption)}`);
    } else if (isSensitive(permission)) {
      violations.push(
        `${where(binding)}: ${permission} is sensitive and cannot be exempt from audit`,
      );
    }
  }

  for (const key of Object.keys(nonMetadataMutations)) {
    const [method, route] = key.split(" ");
    if (!mutations.some((binding) => binding.method === method && binding.route === route)) {
      violations.push(`${key}: listed in NON_METADATA_MUTATIONS but no such route; remove it`);
    }
  }

  return violations;
}
