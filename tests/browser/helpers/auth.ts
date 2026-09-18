import type { Page } from "@playwright/test";
import { waitForHydration } from "./hydration";

/**
 * Log in through the real form, as a learner would.
 *
 * `getByLabel("Password")` matched two controls — the input, whose label is
 * "Password", and the visibility toggle, whose aria-label is "Show password" —
 * because Playwright's label matching is a substring match by default. Every
 * authenticated journey died here on a strict-mode violation, and nobody knew,
 * because the journeys skipped for want of credentials and so never reached the
 * form. `exact: true` is the same fix the keyboard specs already carry.
 *
 * The accessible names are distinct and are announced distinctly, so this is a
 * selector problem rather than an accessibility one.
 */
export async function loginWithCredentials(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/login");

  // Wait for hydration before clicking. The form is progressively enhanced:
  // until React attaches, the button submits natively, the server re-renders
  // /login, and the client-side `window.location.href = destination` that
  // performs the post-login navigation never runs. The symptom is a POST that
  // returns an HTML document and a page that simply sits there — which is
  // exactly what this helper used to do. See helpers/hydration.ts for why a
  // load-state wait is not a substitute.
  await waitForHydration(page);

  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // `commit` rather than the default `load`: leaving /login is the thing being
  // waited for, and the destination is another route the dev server may still
  // have to compile. Waiting for its full load here charges that compile to the
  // login step and hides which part was slow — the spec's own assertions wait
  // for the content anyway.
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), {
    timeout: 60_000,
    waitUntil: "commit",
  });
}
