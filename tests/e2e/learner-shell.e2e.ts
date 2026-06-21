import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../apps/web/src");

describe("ATL-STORY-038 learner shell e2e wiring", () => {
  it("includes learner shell gate and route registry", () => {
    expect(existsSync(resolve(webRoot, "components/shells/LearnerShellGate.tsx"))).toBe(true);
    expect(existsSync(resolve(webRoot, "features/learner/learner-route-registry.ts"))).toBe(true);
  });

  it("root resolver renders A1 for anonymous and L1 for learners", () => {
    const source = readFileSync(resolve(webRoot, "app/page.tsx"), "utf8");
    expect(source).toContain("PublicLandingView");
    expect(source).toContain("LearnerDashboardView");
    expect(source).toContain("error.status === 401");
  });

  it("learner shell exposes search, notifications, profile, and mobile nav", () => {
    const source = readFileSync(
      resolve(webRoot, "components/shells/LearnerShellClient.tsx"),
      "utf8",
    );
    expect(source).toContain('aria-label="Mobile learner navigation"');
    expect(source).toContain('href="/search"');
    expect(source).toContain('href="/notifications"');
    expect(source).toContain('aria-label="Profile menu"');
  });

  it("L1 dashboard limits primary viewport CTAs", () => {
    const source = readFileSync(
      resolve(webRoot, "features/learner/components/LearnerDashboardView.tsx"),
      "utf8",
    );
    expect(source).toContain("Next best action");
    expect(source).toContain("Continue learning");
    expect(source).toContain("Recommended practice");
  });

  it("settings includes Story 037 deletion entry and logout confirmation", () => {
    const settings = readFileSync(resolve(webRoot, "app/settings/page.tsx"), "utf8");
    expect(settings).toContain("AccountDeletionCard");

    const logout = readFileSync(
      resolve(webRoot, "features/learner/components/LogoutConfirmButton.tsx"),
      "utf8",
    );
    expect(logout).toContain("Confirm sign out");
    expect(logout).toContain('clearClientDataCache("logout")');
  });

  it("covers learner journey route files", () => {
    const journeyPaths = [
      "app/page.tsx",
      "app/courses/page.tsx",
      "app/courses/[id]/page.tsx",
      "app/courses/[id]/lessons/[lessonId]/page.tsx",
      "app/assessments/[id]/page.tsx",
      "app/attempts/[id]/page.tsx",
      "app/attempts/[id]/result/page.tsx",
      "app/(learner)/readiness/page.tsx",
      "app/(learner)/swipe/page.tsx",
      "app/(learner)/progress/page.tsx",
      "app/(learner)/community/page.tsx",
      "app/(learner)/community/spaces/[id]/page.tsx",
      "app/(learner)/community/posts/[id]/page.tsx",
      "app/(learner)/search/page.tsx",
      "app/profile/page.tsx",
      "app/settings/page.tsx",
    ];

    for (const relativePath of journeyPaths) {
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
    }
  });

  it("assessment and attempt routes use learner shell layouts", () => {
    expect(readFileSync(resolve(webRoot, "app/assessments/layout.tsx"), "utf8")).toContain(
      "LearnerShell",
    );
    expect(readFileSync(resolve(webRoot, "app/attempts/layout.tsx"), "utf8")).toContain(
      "LearnerShell",
    );
  });
});
