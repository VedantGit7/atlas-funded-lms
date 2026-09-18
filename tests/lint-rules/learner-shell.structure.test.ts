import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../frontend/apps/web/src");

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
    // The drawer is labelled by its open/close controls now rather than a
    // single "Mobile learner navigation" landmark. The affordance is what
    // matters — a mobile user can open and close the nav — so assert the
    // controls and the landmark, not the exact wording of a label that a
    // copy tweak can move.
    expect(source).toContain('aria-label="Learner navigation"');
    expect(source).toContain('aria-label="Open menu"');
    expect(source).toContain('aria-label="Close menu"');
    expect(source).toContain('href="/search"');
    // Notifications became a popover rather than a nav link — the shell filters
    // /search and /notifications out of the nav list and renders dedicated
    // controls instead. Asserting the old href reported the affordance missing
    // when it had been upgraded.
    expect(source).toContain("LearnerNotificationPopover");
    // The profile control is a link carrying the member avatar and name, so
    // its accessible name comes from its content — an aria-label would now be
    // redundant, and asserting one reported a missing affordance that is present.
    expect(source).toContain('href="/profile"');
  });

  it("L1 dashboard limits primary viewport CTAs", () => {
    const source = readFileSync(
      resolve(webRoot, "features/learner/components/LearnerDashboardView.tsx"),
      "utf8",
    );
    // This pinned three section headings that the dashboard redesign replaced
    // ("Build your plan", "Sharpen daily", ...). Copy is the wrong thing to
    // assert: renaming a heading is not a regression, but losing the dedicated
    // next-best-action slot would be. That slot is `personalizedSection`, which
    // the home page streams under Suspense so it loads independently.
    expect(source).toContain("personalizedSection");
    expect(source).toContain("LearnerDashboard");
  });

  it("settings includes Story 037 deletion entry and logout confirmation", () => {
    // /settings is a redirect to /profile now, so the deletion entry lives on
    // the danger-zone page. Reading the redirect stub found nothing and reported
    // account deletion as missing when it had only moved.
    const legacySettings = readFileSync(resolve(webRoot, "app/settings/page.tsx"), "utf8");
    expect(legacySettings).toContain("redirect");
    expect(legacySettings).toContain("/profile");

    const dangerZone = readFileSync(resolve(webRoot, "app/profile/danger-zone/page.tsx"), "utf8");
    expect(dangerZone).toContain("AccountDeletionCard");

    const logout = readFileSync(
      resolve(webRoot, "features/learner/components/LogoutConfirmButton.tsx"),
      "utf8",
    );
    expect(logout).toContain("Confirm sign out");
    // The cache clear moved into the shared `performAtlasLogout` helper, so
    // every logout entry point gets it rather than just this button. Asserted
    // where it now lives.
    expect(logout).toContain("performAtlasLogout");

    const logoutHelper = readFileSync(resolve(webRoot, "lib/auth/perform-logout.ts"), "utf8");
    expect(logoutHelper).toContain('clearClientDataCache("logout")');
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
