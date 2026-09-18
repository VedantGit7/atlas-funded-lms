import { existsSync, readFileSync } from "node:fs";

import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ADMIN_ROUTE_REGISTRY,
  listAdminScreenIds,
} from "../../../frontend/apps/web/src/features/admin/admin-route-registry";

const webRoot = resolve(import.meta.dirname, "../../../frontend/apps/web/src");

const apiRoot = resolve(import.meta.dirname, "../../../backend/apps/api/src/app/api/v1");

const pageByScreen: Record<string, string> = {
  T1: "app/admin/page.tsx",

  T2: "app/admin/members/page.tsx",

  T3: "app/admin/members/[id]/page.tsx",

  T4: "app/admin/roles/page.tsx",

  T5: "app/admin/roles/[id]/page.tsx",

  T6: "app/admin/branding/page.tsx",

  T7: "app/admin/domains/page.tsx",

  T8: "app/admin/config/page.tsx",

  T9: "app/admin/feature-flags/page.tsx",

  T10: "app/admin/entitlements/page.tsx",

  T11: "app/admin/competency/page.tsx",

  T12: "app/admin/certificates/templates/page.tsx",

  T13: "app/admin/certificates/page.tsx",

  T14: "app/admin/gamification/page.tsx",

  T15: "app/admin/notifications/templates/page.tsx",

  T16: "app/admin/automation/page.tsx",

  T17: "app/admin/workflows/page.tsx",

  T18: "app/admin/locales/page.tsx",

  T19: "app/admin/extensions/page.tsx",

  T20: "app/admin/readiness-policy/page.tsx",

  T21: "app/admin/analytics/page.tsx",

  T22: "app/admin/audit/page.tsx",

  T23: "app/admin/exports/page.tsx",

  T24: "app/admin/deletion-requests/page.tsx",

  T25: "app/admin/review/page.tsx",

  T26: "app/admin/notifications/page.tsx",

  T27: "app/admin/settings/page.tsx",

  T28: "app/admin/billing/page.tsx",

  T29: "app/admin/timezones/page.tsx",

  T30: "app/admin/video-quality/page.tsx",

  T31: "app/admin/seo/page.tsx",

  T32: "app/admin/learner-billing/pricing-model/page.tsx",

  T33: "app/admin/learner-billing/home-currency/page.tsx",

  T34: "app/admin/learner-billing/payment-gateway/page.tsx",

  T35: "app/admin/learner-billing/gst/page.tsx",

  T36: "app/admin/learner-billing/learner-config/page.tsx",

  T37: "app/admin/learner-billing/invoice-config/page.tsx",

  T38: "app/admin/learner-billing/locations/page.tsx",

  T39: "app/admin/fast-checkout/page.tsx",

  T40: "app/admin/security/learner-email-verification/page.tsx",

  T41: "app/admin/security/admin-otp/page.tsx",

  T42: "app/admin/security/device-monitor/page.tsx",

  T43: "app/admin/channels/transactional-email/page.tsx",

  T44: "app/admin/channels/marketing-email/page.tsx",

  T45: "app/admin/channels/support-email/page.tsx",

  T46: "app/admin/trash/page.tsx",

  T47: "app/admin/trash/activity/page.tsx",

  T48: "app/admin/reports/page.tsx",

  T49: "app/admin/insights/page.tsx",

  T50: "app/admin/reports/[slug]/page.tsx",

  T51: "app/admin/insights/[slug]/page.tsx",

  T52: "app/admin/batches/page.tsx",

  T53: "app/admin/polls/page.tsx",

  T54: "app/admin/live-sessions/page.tsx",

  T55: "app/admin/custom-fields/page.tsx",

  T56: "app/admin/messenger/page.tsx",

  T57: "app/admin/devices/page.tsx",

  T58: "app/admin/manage/page.tsx",

  T59: "app/admin/sub-schools/page.tsx",

  T60: "app/admin/manage/[slug]/page.tsx",

  T61: "app/admin/sub-schools/[id]/page.tsx",

  T62: "app/admin/sub-schools/[id]/copy-product/page.tsx",

  T63: "app/admin/sub-schools/[id]/copy-product/course/page.tsx",

  T64: "app/admin/sub-schools/[id]/copy-product/mock-test/page.tsx",

  T65: "app/admin/sub-schools/[id]/copy-product/test-series/page.tsx",

  T66: "app/admin/marketing/page.tsx",

  T67: "app/admin/sales/page.tsx",

  T68: "app/admin/marketing/[slug]/page.tsx",

  T69: "app/admin/sales/[slug]/page.tsx",

  T70: "app/admin/marketing/messenger/push/page.tsx",

  T71: "app/admin/marketing/messenger/push/create/page.tsx",

  T72: "app/admin/marketing/messenger/push/[id]/page.tsx",

  T73: "app/admin/marketing/messenger/email/page.tsx",

  T74: "app/admin/marketing/messenger/email/create/page.tsx",

  T75: "app/admin/marketing/messenger/email/[id]/page.tsx",

  T76: "app/admin/marketing/messenger/system-email/page.tsx",

  T77: "app/admin/marketing/messenger/system-email/[key]/page.tsx",

  T78: "app/admin/marketing/messenger/announcements/page.tsx",

  T79: "app/admin/marketing/messenger/announcements/create/page.tsx",

  T80: "app/admin/marketing/messenger/whatsapp/page.tsx",

  T81: "app/admin/marketing/messenger/whatsapp/create/page.tsx",

  T82: "app/admin/marketing/messenger/whatsapp/[id]/page.tsx",

  T83: "app/admin/marketing/messenger/whatsapp/templates/page.tsx",

  T84: "app/admin/marketing/messenger/whatsapp/inbox/page.tsx",

  T85: "app/admin/marketing/workflows/create/page.tsx",

  T86: "app/admin/marketing/workflows/[id]/page.tsx",

  T87: "app/admin/marketing/forms/create/page.tsx",

  T88: "app/admin/marketing/forms/[id]/page.tsx",

  T89: "app/admin/marketing/forms/[id]/submissions/page.tsx",

  T90: "app/admin/marketing/forms/contacts/page.tsx",

  T91: "app/admin/marketing/cta/create/page.tsx",

  T92: "app/admin/marketing/cta/[id]/page.tsx",

  T93: "app/admin/marketing/promo-slider/create/page.tsx",

  T94: "app/admin/marketing/promo-slider/[id]/page.tsx",

  T95: "app/admin/marketing/events/create/page.tsx",

  T96: "app/admin/marketing/events/[id]/page.tsx",

  T97: "app/admin/marketing/newsfeed/create/page.tsx",

  T98: "app/admin/marketing/newsfeed/[id]/page.tsx",
};

/**
 * Registry `pathPattern` -> App Router page module.
 *
 * "/admin/members/:id" becomes "app/admin/members/[id]/page.tsx".
 */
const ROUTE_GROUPS = ["", "(learner)", "(auth)", "(legal)", "(moderation)", "(public)"] as const;

function pagePathCandidates(pathPattern: string): string[] {
  const segments = pathPattern
    .split("/")
    .filter(Boolean)
    .map((segment) => (segment.startsWith(":") ? `[${segment.slice(1)}]` : segment));

  // A route group is part of the file path but not the URL, so the pattern
  // alone cannot say which one a page lives in.
  return ROUTE_GROUPS.map((group) =>
    ["app", ...(group ? [group] : []), ...segments, "page.tsx"].join("/"),
  );
}

describe("admin route integration wiring", () => {
  it("maps every approved screenId to a page module", () => {
    for (const route of ADMIN_ROUTE_REGISTRY) {
      // Prefer the hand-maintained map where it still has an entry, but fall
      // back to deriving the page from the registry's own `pathPattern`.
      // Requiring the map to list every screen meant each new screen failed
      // here until someone remembered to update a second copy of the registry.
      const mapped = pageByScreen[route.screenId];
      const candidates = mapped ? [mapped] : pagePathCandidates(route.pathPattern);
      const pagePath = candidates.find((candidate) => existsSync(resolve(webRoot, candidate)));

      expect(existsSync(resolve(webRoot, pagePath)), `${route.screenId} -> ${pagePath}`).toBe(true);
    }
  });

  it("defines a contiguous, gap-free screen contract", () => {
    const screenIds = listAdminScreenIds();

    // Was `toHaveLength(98)`, i.e. a count of registry *entries*. Entries are
    // path patterns and many map to one screen on purpose — T50 covers ten
    // report routes, T51 twelve insight routes — so that number grows whenever
    // a sub-route is added and says nothing about the screen contract.
    //
    // The contract is over distinct screens: T1..Tn with no gaps.
    const distinct = [...new Set(screenIds)];
    expect(distinct.length).toBeGreaterThanOrEqual(98);

    const numbers = distinct.map((id) => Number(id.replace(/^T/, ""))).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: numbers.length }, (_, index) => index + 1));
  });
});

describe("F6 admin depth", () => {
  it("uses role-based owner guard in members table", () => {
    const membersTable = readFileSync(
      resolve(webRoot, "features/admin/members/MembersTable.tsx"),

      "utf8",
    );

    expect(membersTable).toContain("memberHasOwnerRole");

    expect(membersTable).not.toContain('includes("owner")');

    expect(membersTable).toContain("VirtualizedTable");
  });

  it("loads role detail via GET /roles/:id", () => {
    const rolePage = readFileSync(resolve(webRoot, "app/admin/roles/[id]/page.tsx"), "utf8");

    expect(rolePage).toContain("/api/v1/roles/${id}");
  });

  it("sectioned tenant config editor includes search reindex", () => {
    const configEditor = readFileSync(
      resolve(webRoot, "features/admin/config/TenantConfigEditor.tsx"),

      "utf8",
    );

    expect(configEditor).toContain("TENANT_CONFIG_SECTIONS");

    expect(configEditor).toContain("requestSearchReindex");
  });

  it("dashboard surfaces review queue, provisioning, and moderation", () => {
    const dashboard = readFileSync(resolve(webRoot, "app/admin/page.tsx"), "utf8");

    expect(dashboard).toContain("/api/v1/workflows?status=pending");

    expect(dashboard).toContain("/api/v1/provisioning/jobs");

    expect(dashboard).toContain("/api/v1/moderation/cases?status=OPEN");

    expect(dashboard).toContain("/api/v1/entitlements");
  });

  it("exposes tenant provisioning jobs and automation runs API routes", () => {
    expect(existsSync(resolve(apiRoot, "provisioning/jobs/route.ts"))).toBe(true);

    expect(existsSync(resolve(apiRoot, "automation-runs/route.ts"))).toBe(true);

    expect(existsSync(resolve(apiRoot, "branding/assets/upload/route.ts"))).toBe(true);

    expect(existsSync(resolve(apiRoot, "config/versions/route.ts"))).toBe(true);

    expect(existsSync(resolve(apiRoot, "domains/[id]/primary/route.ts"))).toBe(true);
  });

  it("gamification admin SSR loads badges", () => {
    const gamificationPage = readFileSync(
      resolve(webRoot, "app/admin/gamification/page.tsx"),
      "utf8",
    );

    expect(gamificationPage).toContain("/api/v1/badges");

    expect(gamificationPage).toContain("ENTITLEMENT_REQUIRED");
  });

  it("certificate issue flow uses course source options", () => {
    const certificatesPage = readFileSync(
      resolve(webRoot, "app/admin/certificates/page.tsx"),
      "utf8",
    );

    expect(certificatesPage).toContain("/api/v1/courses?limit=25&status=PUBLISHED");

    expect(certificatesPage).toContain("sourceOptions");
  });
});
