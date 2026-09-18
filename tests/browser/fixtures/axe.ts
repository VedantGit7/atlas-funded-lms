import AxeBuilder from "@axe-core/playwright";
import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

type AxeFixtures = {
  assertNoCriticalViolations: () => Promise<void>;
};

/**
 * How long to allow entrance animations to finish before scanning.
 *
 * The observed fades complete in about 600ms; this is generous so that a slow
 * machine does not turn a settled page into a timeout.
 */
const ANIMATION_SETTLE_TIMEOUT_MS = 10_000;

/**
 * Wait until nothing is mid-fade.
 *
 * Colour-contrast is computed from the *rendered* colour, so an element caught
 * during an entrance animation is measured at whatever opacity it happened to
 * have. The learner dashboard runs four `opacity: 0 → 1` fades for roughly the
 * first 600ms after navigation; scanning inside that window composited
 * `--muted-foreground` (#6f6f6f, a passing 5.02:1 on white) down to #7c7c7c, a
 * failing 4.17:1, and reported 93 serious violations. The same build scanned a
 * moment later reported none.
 *
 * That is a coin flip, not a finding, and an accessibility suite that fails at
 * random gets ignored — which is worse than not having one. Waiting for the
 * page to settle makes every violation this suite reports a real one.
 *
 * Infinite animations are excluded deliberately: a pulsing status dot never
 * finishes, so waiting for it would hang. Those are handled by the
 * reduced-motion emulation below instead — waiting is the wrong tool for
 * something that never settles.
 */
async function waitForAnimationsToSettle(page: Page): Promise<void> {
  // Best-effort. Reduced motion has already switched off the animations this
  // codebase gates behind `motion-safe:`, so this is a second line of defence
  // against a fade that is not gated — and a second line of defence must not
  // become a new way to fail. An animation that never settles is a reason to
  // scan anyway, not a reason to report an accessibility failure that was never
  // measured.
  try {
    await page.waitForFunction(
      () =>
        document.getAnimations().every((animation) => {
          if (animation.playState !== "running") return true;
          const iterations = animation.effect?.getComputedTiming().iterations;
          return iterations === Infinity;
        }),
      undefined,
      { timeout: ANIMATION_SETTLE_TIMEOUT_MS },
    );
  } catch {
    // Fall through and scan.
  }
}

export const test = base.extend<AxeFixtures>({
  assertNoCriticalViolations: async ({ page }, use) => {
    await use(async () => {
      // Stop the animations before measuring, then let what remains settle.
      //
      // Colour-contrast is computed from the rendered colour, so an element
      // inside anything animating opacity is measured at whatever value that
      // animation happened to be at. The proof is that the reported colour
      // moved between runs of the same build: #7c7c7c (4.17:1) in one,
      // #797979 (4.35:1) in the next, both of them `--muted-foreground`
      // (#6f6f6f, a passing 5.02:1 on white) composited at about 0.92.
      //
      // Waiting alone cannot fix an infinite animation, and this codebase gates
      // its animations behind `motion-safe:`, so asking for reduced motion
      // switches them off at the source. It also measures what a
      // reduced-motion user actually sees, which is the more useful question.
      //
      // The network wait comes first and matters most. `main` being visible is
      // not the page being loaded: the dashboard streams its islands, so the
      // shell and its skeletons render immediately. Scanning then measures
      // placeholders — one run reported #ffffff and #bcbcbc at 1.6:1 and 1.9:1,
      // which is a skeleton doing its job, not a defect. Contrast can only be
      // judged once the real content is on the page.
      // Bounded and best-effort. `networkidle` never fires on a page that holds
      // a connection open, so an unbounded wait here would spend the whole test
      // budget and report a timeout instead of an accessibility result.
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await waitForAnimationsToSettle(page);
      const results = await new AxeBuilder({ page }).analyze();
      const critical = results.violations.filter(
        (violation) => violation.impact === "critical" || violation.impact === "serious",
      );
      expect(critical, formatViolations(critical)).toEqual([]);

      // Leave the page as it was found: a spec may assert on motion after this.
      await page.emulateMedia({ reducedMotion: null });
    });
  },
});

export { expect } from "@playwright/test";

function formatViolations(
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"],
): string {
  if (violations.length === 0) {
    return "";
  }
  return violations
    .map((violation) => `${violation.id}: ${violation.help} (${violation.impact})`)
    .join("\n");
}
