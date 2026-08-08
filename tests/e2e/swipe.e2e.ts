import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveSplitPath, splitPathExists, webRoot } from "./split-layout-paths";

const swipePaths = [
  "app/(learner)/swipe/page.tsx",
  "app/(learner)/swipe/layout.tsx",
  "app/api/v1/me/srs/due/route.ts",
  "app/api/v1/me/srs/due/route.metadata.ts",
  "app/api/v1/practice-sessions/route.ts",
  "app/api/v1/practice-sessions/route.metadata.ts",
  "app/api/v1/practice-sessions/[id]/responses/route.ts",
  "app/api/v1/practice-sessions/[id]/responses/route.metadata.ts",
  "app/api/v1/practice-sessions/[id]/complete/route.ts",
  "app/api/v1/practice-sessions/[id]/complete/route.metadata.ts",
  "server/practice/practice.service.ts",
  "features/practice/components/SwipePracticeClient.tsx",
  "features/practice/components/SwipeDeckPicker.tsx",
  "features/practice/components/SwipeSessionSummaryDialog.tsx",
];

describe("swipe e2e wiring", () => {
  it("includes approved learner screen and APIs", () => {
    for (const relativePath of swipePaths) {
      expect(splitPathExists(relativePath)).toBe(true);
    }
  });

  it("learner swipe page uses PageGate and approved APIs", () => {
    const source = readFileSync(resolveSplitPath("app/(learner)/swipe/page.tsx"), "utf8");
    expect(source).toContain("PageGate");
    expect(source).toContain("practiceServerApi");
    expect(source).toContain("SwipePracticeClient");
  });

  it("swipe client uses approved practice APIs and preserves retry idempotency key", () => {
    const source = readFileSync(
      resolveSplitPath("features/practice/components/SwipePracticeClient.tsx"),
      "utf8",
    );
    const clientApiSource = readFileSync(resolveSplitPath("lib/client-api.ts"), "utf8");

    expect(source).toContain("/api/v1/practice-sessions");
    expect(source).toContain("postWithKey");
    expect(source).toContain("swipe-known-button");
    expect(source).toContain("ArrowRight");
    expect(source).toContain("prefers-reduced-motion");
    expect(source).not.toMatch(/localStorage|sessionStorage/);
    expect(clientApiSource).toContain("postWithKey");
  });

  it("completion modal avoids fake XP totals", () => {
    const source = readFileSync(
      resolveSplitPath("features/practice/components/SwipeSessionSummaryDialog.tsx"),
      "utf8",
    );
    expect(source).toContain("Practice recorded");
    expect(source).not.toContain("XP earned");
  });

  it("learner shell links to swipe route", () => {
    const source = readFileSync(resolveSplitPath("components/shells/LearnerShell.tsx"), "utf8");
    expect(source).toContain("/swipe");
  });
});
