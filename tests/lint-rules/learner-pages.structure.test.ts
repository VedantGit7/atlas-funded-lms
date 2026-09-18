import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../frontend/apps/web/src");

const learnerPages = [
  "app/page.tsx",
  "app/courses/page.tsx",
  "app/(learner)/certificates/page.tsx",
  "app/(learner)/community/page.tsx",
  "app/(learner)/achievements/page.tsx",
  "app/profile/page.tsx",
  // app/settings/page.tsx is intentionally absent: it is now a redirect-only shim
  // forwarding legacy /settings links to /profile*. It fetches no data and renders
  // nothing, so there is no denied state to handle. Its redirect target is a
  // server-side constant, so it is not an open-redirect surface either.
];

describe("learner page authorization patterns", () => {
  for (const relativePath of learnerPages) {
    it(`${relativePath} handles denied auth states`, () => {
      const source = readFileSync(resolve(webRoot, relativePath), "utf8");
      expect(source).toMatch(/ServerApiError|loadLearnerShellContext|PageGate/);
      expect(source).toMatch(/401|403|denied|not_found/);
    });
  }

  it("entitlement-gated pages surface entitlement-required handling", () => {
    const certificates = readFileSync(
      resolve(webRoot, "app/(learner)/certificates/page.tsx"),
      "utf8",
    );
    expect(certificates).toContain("ENTITLEMENT_REQUIRED");

    const community = readFileSync(resolve(webRoot, "app/(learner)/community/page.tsx"), "utf8");
    expect(community).toContain("ENTITLEMENT_REQUIRED");
  });

  it("learner shell gate blocks nav before membership resolves", () => {
    const source = readFileSync(resolve(webRoot, "components/shells/LearnerShellGate.tsx"), "utf8");
    expect(source).toContain("loadLearnerShellContext");
    expect(source).toContain("membership_blocked");
    expect(source).not.toMatch(/role\.name|membership\.role/);
  });
});

describe("learner shell component expectations", () => {
  it("includes required nav destinations", () => {
    const navSource = readFileSync(
      resolve(webRoot, "features/learner/learner-navigation.ts"),
      "utf8",
    );
    const shellSource = readFileSync(
      resolve(webRoot, "components/shells/LearnerShellClient.tsx"),
      "utf8",
    );
    for (const href of [
      "/search",
      "/notifications",
      "/roadmap",
      "/progress",
      "/readiness",
      "/practice",
      "/community",
      "/hall-of-fame",
      "/achievements",
      "/leaderboards",
    ]) {
      expect(navSource + shellSource).toContain(`"${href}"`);
    }
    for (const href of ["/profile", "/settings"]) {
      expect(shellSource).toContain(`"${href}"`);
    }
  });

  it("does not expose admin or platform navigation", () => {
    const source = readFileSync(resolve(webRoot, "features/learner/learner-navigation.ts"), "utf8");
    expect(source).not.toMatch(/\/admin|\/studio|\/platform|\/moderate/);
  });
});

describe("learner page existence for authorization matrix", () => {
  it("includes profile and resources routes", () => {
    expect(existsSync(resolve(webRoot, "app/profile/page.tsx"))).toBe(true);
    expect(existsSync(resolve(webRoot, "app/(learner)/resources/page.tsx"))).toBe(true);
  });
});
