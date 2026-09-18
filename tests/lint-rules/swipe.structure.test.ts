import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveSplitPath, splitPathExists } from "./split-layout-paths";

// /swipe is a redirect to /practice now, so it has no layout of its own — a
// redirect renders nothing to lay out. The implementation moved wholesale; the
// API and component paths below are still the real surface.
const swipePaths = [
  "app/(learner)/swipe/page.tsx",
  "app/(learner)/practice/layout.tsx",
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

  it("keeps /swipe working as a redirect to the practice route", () => {
    // This asserted PageGate + practiceServerApi + SwipePracticeClient on the
    // swipe page, which stopped being true when the route became a redirect.
    // The behaviour worth pinning is that the old link still resolves.
    const source = readFileSync(resolveSplitPath("app/(learner)/swipe/page.tsx"), "utf8");
    expect(source).toContain("redirect");
    expect(source).toContain("/practice");
  });

  it("swipe client uses approved practice APIs and preserves retry idempotency key", () => {
    const source = readFileSync(
      resolveSplitPath("features/practice/components/SwipePracticeClient.tsx"),
      "utf8",
    );
    // `lib/client-api.ts` is a barrel now; `postWithKey` is defined in
    // `lib/api/client.ts`. Reading the barrel found nothing and reported the
    // idempotency helper as missing when it was one re-export away.
    const clientApiSource = readFileSync(resolveSplitPath("lib/api/client.ts"), "utf8");

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

  it("learner shell links to the practice route", () => {
    // Was `/swipe`. The route moved to `/practice` and the shell moved with it;
    // `/swipe` is only a redirect now, so linking to it would be a regression,
    // not the thing to assert.
    const source = readFileSync(resolveSplitPath("components/shells/LearnerShell.tsx"), "utf8");
    expect(source).toContain("/practice");
  });
});
