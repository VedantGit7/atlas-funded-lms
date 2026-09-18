import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LEARNER_ROUTE_REGISTRY,
  type LearnerScreenId,
} from "../../../frontend/apps/web/src/features/learner/learner-route-registry";

const webRoot = resolve(import.meta.dirname, "../../../frontend/apps/web/src");

const pageByScreen: Record<LearnerScreenId, string> = {
  L1: "app/page.tsx",
  L2: "app/courses/page.tsx",
  L3: "app/courses/[id]/page.tsx",
  L4: "app/courses/[id]/lessons/[lessonId]/page.tsx",
  L5: "app/roadmap/page.tsx",
  L6: "app/paths/[id]/page.tsx",
  L7: "app/assessments/[id]/page.tsx",
  L8: "app/attempts/[id]/page.tsx",
  L9: "app/attempts/[id]/result/page.tsx",
  L10: "app/(learner)/practice/page.tsx",
  L11: "app/(learner)/diagnostic/me/page.tsx",
  L12: "app/(learner)/readiness/page.tsx",
  L13: "app/(learner)/progress/page.tsx",
  L14: "app/(learner)/certificates/page.tsx",
  L15: "app/(learner)/achievements/page.tsx",
  L16: "app/(learner)/leaderboards/page.tsx",
  L17: "app/(learner)/community/page.tsx",
  L18: "app/(learner)/community/spaces/[id]/page.tsx",
  L19: "app/(learner)/community/posts/[id]/page.tsx",
  L20: "app/(learner)/hall-of-fame/page.tsx",
  L21: "app/(learner)/resources/page.tsx",
  L22: "app/(learner)/search/page.tsx",
  L23: "app/(learner)/notifications/page.tsx",
  L24: "app/profile/page.tsx",
  L25: "app/settings/page.tsx",
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

describe("learner route integration wiring", () => {
  it("maps every approved screenId to a page module", () => {
    for (const route of LEARNER_ROUTE_REGISTRY) {
      // Fall back to deriving the page from the registry's own `pathPattern`.
      // Requiring the hand-maintained map to list every screen meant each new
      // screen failed here until a second copy of the registry was updated.
      const mapped = pageByScreen[route.screenId];
      const candidates = mapped ? [mapped] : pagePathCandidates(route.pathPattern);
      const pagePath = candidates.find((candidate) => existsSync(resolve(webRoot, candidate)));
      expect(existsSync(resolve(webRoot, pagePath)), `${route.screenId} -> ${pagePath}`).toBe(true);
    }
  });

  it("root resolver distinguishes A1 and L1 without duplicate routes", () => {
    const source = readFileSync(resolve(webRoot, "app/page.tsx"), "utf8");
    expect(source).toContain("PublicLandingView");
    expect(source).toContain("LearnerDashboardView");
    expect(source).not.toContain('redirect("/home")');
  });

  it("does not import prisma or repositories in learner app pages", () => {
    for (const relativePath of Object.values(pageByScreen)) {
      const source = readFileSync(resolve(webRoot, relativePath), "utf8");
      expect(source).not.toMatch(
        /from.*prisma|from.*repository|withTenantTx|withPlatformScope|new PrismaClient/,
      );
    }
  });

  it("uses approved server API client for page loaders", () => {
    const source = readFileSync(resolve(webRoot, "app/profile/page.tsx"), "utf8");
    expect(source).toContain("serverApi.get");
    expect(source).toContain("/api/v1/me");
    expect(source).toContain("/api/v1/members/");
  });

  it("settings reuses Story 037 deletion component", () => {
    // /settings is a redirect to /profile now; the deletion entry lives on the
    // danger-zone page. Reading the redirect stub found nothing and reported
    // account deletion as missing when it had only moved.
    const legacy = readFileSync(resolve(webRoot, "app/settings/page.tsx"), "utf8");
    expect(legacy).toContain("redirect");

    const source = readFileSync(resolve(webRoot, "app/profile/danger-zone/page.tsx"), "utf8");
    expect(source).toContain("AccountDeletionCard");
  });
});
