import { test, expect } from "../fixtures/axe";
import { waitForHydration } from "../helpers/hydration";

test.describe("keyboard accessibility flows", () => {
  /**
   * Two things were wrong with these before, and neither was a product defect.
   *
   * `getByLabel("Password")` matched two controls — the password input, whose
   * label is "Password", and the visibility toggle, whose aria-label is "Show
   * password" — because Playwright's label matching is substring by default.
   * The audit read that collision as a genuine accessibility problem. It is not:
   * the two accessible names are distinct, and a screen reader announces them as
   * "Password, edit" and "Show password, button". `exact: true` resolves it.
   *
   * The tab-order expectation was stale in a more interesting way. It asserted
   * a fixed sequence — first Tab lands on Email, then Password, then Sign in —
   * and every part of that was wrong: the login screen has chrome above the
   * form, and the form itself contains a visibility toggle and a "remember me"
   * checkbox between the password field and the submit button. Both are
   * interactive controls that *should* take focus; a form that skipped them
   * would be the accessibility failure.
   *
   * Encoding the exact sequence just moves the brittleness around — it breaks
   * whenever anyone adds a link to the form. What matters for a keyboard user is
   * weaker and more durable: from the first field, tabbing forward reaches the
   * submit button in a bounded number of steps, and never lands on something
   * inert on the way. That is what this asserts.
   */
  test("login form supports keyboard tab order", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email", { exact: true }).focus();
    await expect(page.getByLabel("Email", { exact: true })).toBeFocused();

    const INTERACTIVE = new Set(["INPUT", "BUTTON", "A", "SELECT", "TEXTAREA"]);
    const visited: string[] = [];
    let reachedSubmit = false;

    // Bounded so a focus trap fails the test rather than hanging it.
    for (let step = 0; step < 12; step += 1) {
      await page.keyboard.press("Tab");

      const focused = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return null;
        return {
          tag: el.tagName,
          type: el.getAttribute("type"),
          name: el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 40) ?? "",
        };
      });

      if (!focused) break;
      visited.push(`${focused.tag}${focused.type ? `[${focused.type}]` : ""}`);

      // Focus must never rest on a non-interactive element.
      expect(
        INTERACTIVE,
        `focus landed on <${focused.tag}> after ${visited.join(" -> ")}`,
      ).toContain(focused.tag);

      if (focused.tag === "BUTTON" && focused.type === "submit") {
        reachedSubmit = true;
        break;
      }
    }

    expect(reachedSubmit, `never reached submit; visited ${visited.join(" -> ")}`).toBe(true);
  });

  test("login submit via keyboard Enter", async ({ page }) => {
    await page.goto("/login");
    await waitForHydration(page);
    await page.getByLabel("Email", { exact: true }).fill("invalid@example.test");

    const password = page.getByLabel("Password", { exact: true });
    await password.fill("invalid-password");
    const submitted = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/login" && response.request().method() === "POST",
    );
    await password.press("Enter");
    expect((await submitted).status()).toBe(200);
    await expect(
      page.getByRole("alert").filter({ hasText: /invalid|incorrect|sign.in|credentials/i }),
    ).toBeVisible();
    await expect(password).toBeFocused();
  });

  test("public landing quick links are keyboard reachable", async ({ page }) => {
    await page.goto("/p/home");
    await page.keyboard.press("Tab");
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]).toContain(focusedTag);
  });
});
