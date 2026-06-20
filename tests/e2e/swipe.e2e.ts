import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../apps/web/src");

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
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
    }
  });

  it("learner swipe page uses PageGate and approved APIs", () => {
    const source = readFileSync(resolve(webRoot, "app/(learner)/swipe/page.tsx"), "utf8");
    expect(source).toContain("PageGate");
    expect(source).toContain("practiceServerApi");
    expect(source).toContain("SwipePracticeClient");
  });

  it("swipe client uses approved practice APIs and preserves retry idempotency key", () => {
    const source = readFileSync(
      resolve(webRoot, "features/practice/components/SwipePracticeClient.tsx"),
      "utf8",
    );
    const clientApiSource = readFileSync(resolve(webRoot, "lib/client-api.ts"), "utf8");

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
      resolve(webRoot, "features/practice/components/SwipeSessionSummaryDialog.tsx"),
      "utf8",
    );
    expect(source).toContain("Practice recorded");
    expect(source).not.toContain("XP earned");
  });

  it("learner shell links to swipe route", () => {
    const source = readFileSync(resolve(webRoot, "components/shells/LearnerShell.tsx"), "utf8");
    expect(source).toContain("/swipe");
  });
});
