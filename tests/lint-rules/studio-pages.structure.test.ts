import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../frontend/apps/web/src");

const studioPages = [
  "app/studio/page.tsx",
  "app/studio/courses/page.tsx",
  "app/studio/courses/[id]/learners/page.tsx",
  "app/studio/courses/[id]/lessons/[lessonId]/page.tsx",
  "app/studio/items/page.tsx",
  "app/studio/items/[id]/page.tsx",
  "app/studio/item-collections/page.tsx",
  "app/studio/assessments/page.tsx",
  "app/studio/assessments/[id]/page.tsx",
  "app/studio/learning-paths/page.tsx",
  "app/studio/learning-paths/[id]/page.tsx",
  "app/studio/grading/page.tsx",
  "app/studio/grading/[taskId]/page.tsx",
  "app/studio/analytics/page.tsx",
];

describe("studio page authorization patterns", () => {
  for (const relativePath of studioPages) {
    it(`${relativePath} handles denied auth states`, () => {
      const source = readFileSync(resolve(webRoot, relativePath), "utf8");
      expect(source).toMatch(/ServerApiError|PageGate/);
      expect(source).toMatch(/401|403|denied|not_found/);
    });
  }

  it("app/studio/courses/[id]/layout.tsx handles denied auth states for tabbed course routes", () => {
    const source = readFileSync(resolve(webRoot, "app/studio/courses/[id]/layout.tsx"), "utf8");
    expect(source).toMatch(/ServerApiError|PageGate/);
    expect(source).toMatch(/403|404|not_found/);
  });

  it("I13 checks analytics entitlement before loading dashboard content", () => {
    const source = readFileSync(resolve(webRoot, "app/studio/analytics/page.tsx"), "utf8");
    expect(source).toContain("/api/v1/entitlements");
    expect(source).toContain("hasAnalyticsEntitlement");
    expect(source).toContain("ENTITLEMENT_REQUIRED");

    // The dashboard component on this screen is StudioAnalyticsClient.
    // "AnalyticsDashboard" belongs to the ADMIN analytics screen and, per
    // `git log -S`, was never present in this file — the assertion could only
    // ever fail. What matters is that the entitlement check gates the render.
    expect(source).toContain("StudioAnalyticsClient");
    const gateIndex = source.indexOf("hasAnalyticsEntitlement(entitlements.data)");
    expect(gateIndex).toBeGreaterThan(-1);
    expect(source.indexOf("<StudioAnalyticsClient")).toBeGreaterThan(gateIndex);
  });

  it("studio shell gate blocks nav before membership resolves", () => {
    const source = readFileSync(resolve(webRoot, "components/shells/StudioShellGate.tsx"), "utf8");
    expect(source).toContain("loadStudioShellContext");
    expect(source).toContain("membership_blocked");
    expect(source).not.toMatch(/role\.name|membership\.role/);
  });
});

describe("studio shell component expectations", () => {
  it("includes required nav destinations without forbidden links", () => {
    const navSource = readFileSync(
      resolve(webRoot, "features/studio/studio-navigation.ts"),
      "utf8",
    );
    const shellSource = readFileSync(
      resolve(webRoot, "components/shells/studio/StudioShell.tsx"),
      "utf8",
    );

    for (const href of [
      "/studio",
      "/studio/courses",
      "/studio/items",
      "/studio/item-collections",
      "/studio/assessments",
      "/studio/learning-paths",
      "/studio/grading",
      "/studio/analytics",
    ]) {
      expect(navSource).toContain(`"${href}"`);
    }

    expect(navSource).not.toMatch(/\/admin\/|\/moderate|\/platform/);

    // The shell links to the admin dashboard via the ADMIN_DASHBOARD_HREF
    // constant rather than a literal, so asserting on `href="/admin"` pinned an
    // implementation detail that a pure refactor broke. Assert the destination
    // and that the constant still resolves to it.
    expect(shellSource).toContain("href={ADMIN_DASHBOARD_HREF}");
    expect(readFileSync(resolve(webRoot, "lib/branding/document-title.ts"), "utf8")).toContain(
      'ADMIN_DASHBOARD_HREF = "/admin"',
    );
    expect(shellSource).toContain('aria-label="Studio sections"');
    expect(shellSource).toContain('id="studio-main"');
  });

  it("includes I1 and I12 route files", () => {
    expect(existsSync(resolve(webRoot, "app/studio/page.tsx"))).toBe(true);
    expect(existsSync(resolve(webRoot, "app/studio/courses/[id]/learners/page.tsx"))).toBe(true);
  });
});

describe("I12 enrollment capability decision", () => {
  it("does not expose enrollment management mutation UI", () => {
    const roster = readFileSync(
      resolve(webRoot, "features/studio/learners/course-learner-roster.tsx"),
      "utf8",
    );
    expect(roster).not.toMatch(/POST.*enrollments|enrollment\.manage|transfer enrollment/i);
  });
});
