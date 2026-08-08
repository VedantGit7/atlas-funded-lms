import type { EntitlementView } from "@atlas/domain-config/schemas/entitlements";
import { mergeEntitlementsWithCatalogue } from "../entitlements/entitlement-catalogue";

export type BillingPlanSummary = {
  planTitle: string;
  planDescription: string;
  expiryWarning: string | null;
};

function inferPlanTitle(activeCount: number): string {
  if (activeCount >= 6) return "Enterprise plan";
  if (activeCount >= 4) return "Professional plan";
  if (activeCount >= 2) return "Growth plan";
  return "Starter plan";
}

function findNearestPlanExpiry(entitlements: EntitlementView[]): Date | null {
  let nearest: Date | null = null;

  for (const entry of entitlements) {
    if (!entry.enabled || !entry.expiresAt) continue;
    const expires = new Date(entry.expiresAt);
    if (Number.isNaN(expires.getTime())) continue;
    if (expires.getTime() <= Date.now()) continue;
    if (!nearest || expires.getTime() < nearest.getTime()) {
      nearest = expires;
    }
  }

  return nearest;
}

function findExpiredEntitlement(entitlements: EntitlementView[]): boolean {
  return entitlements.some((entry) => {
    if (!entry.enabled || !entry.expiresAt) return false;
    const expires = new Date(entry.expiresAt);
    return !Number.isNaN(expires.getTime()) && expires.getTime() <= Date.now();
  });
}

export function buildBillingPlanSummary(entitlements: EntitlementView[]): BillingPlanSummary {
  const resolved = mergeEntitlementsWithCatalogue(entitlements);
  const activeCount = resolved.filter((entry) => entry.enabled).length;
  const planTitle = inferPlanTitle(activeCount);
  const nearestExpiry = findNearestPlanExpiry(entitlements);

  let planDescription = `${activeCount} capabilities active on your plan.`;
  if (nearestExpiry) {
    planDescription = `Active through ${new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(nearestExpiry)}.`;
  }

  let expiryWarning: string | null = null;

  if (findExpiredEntitlement(entitlements)) {
    expiryWarning =
      "Your academy plan has expired. Contact your platform operator to renew access.";
  } else if (nearestExpiry) {
    const days = Math.ceil((nearestExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 30) {
      const dayLabel = days === 1 ? "day" : "days";
      expiryWarning = `Your academy plan is about to expire in ${days} ${dayLabel}.`;
    }
  }

  return { planTitle, planDescription, expiryWarning };
}
