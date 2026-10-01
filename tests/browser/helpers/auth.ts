import type { Page } from "@playwright/test";
import { waitForSubmitHandler } from "./hydration";
import { totp } from "../../../scripts/e2e/totp.mjs";

/**
 * Time to leave /login after submitting. A cold dev server may first compile the
 * auth routes and then the destination page, so dev mode gets the same headroom
 * the dev-mode journeys already carry; a production build answers in seconds.
 */
const LOGIN_EXIT_TIMEOUT_MS = process.env["BROWSER_E2E_DEV"] === "1" ? 150_000 : 60_000;

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
  destination?: string,
): Promise<void> {
  await page.goto(destination ? `/login?next=${encodeURIComponent(destination)}` : "/login");

  // Wait for this form's handler before filling controlled inputs or clicking.
  // The body can hydrate before a streamed form boundary. The form is progressively enhanced:
  // until React attaches, the button submits natively, the server re-renders
  // /login, and the client-side `window.location.href = destination` that
  // performs the post-login navigation never runs. The symptom is a POST that
  // returns an HTML document and a page that simply sits there — which is
  // exactly what this helper used to do. See helpers/hydration.ts for why a
  // load-state wait is not a substitute.
  const signIn = page.getByRole("button", { name: "Sign In", exact: true });
  await waitForSubmitHandler(page.locator("form").filter({ has: signIn }));

  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await signIn.click();
  const prefix = ["E2E_ADMIN", "E2E_PLATFORM", "E2E_FOREIGN_ADMIN"].find(
    (candidate) => process.env[`${candidate}_EMAIL`] === email,
  );
  if (prefix) {
    const secret = process.env[`${prefix}_TOTP_SECRET`];
    if (!secret) throw new Error(`${prefix}_TOTP_SECRET is required for a real MFA login.`);
    await page.getByRole("heading", { name: "Two-factor verification" }).waitFor();
    const code = totp(secret);
    for (let index = 0; index < 6; index++) {
      await page
        .getByRole("textbox", { name: `Digit ${index + 1}`, exact: true })
        .fill(code.charAt(index));
    }
    await page.getByRole("button", { name: "Verify code", exact: true }).click();
  }
  // `commit` rather than the default `load`: leaving /login is the thing being
  // waited for, and the destination is another route the dev server may still
  // have to compile. Waiting for its full load here charges that compile to the
  // login step and hides which part was slow — the spec's own assertions wait
  // for the content anyway.
  //
  // Leaving /login is raced against the form showing an error, and each ends on
  // its own line. The failure-probe verifier records only the file and line a
  // journey failed at, and J09's probe once stalled here for 60 s with nothing to
  // say whether the MFA code was rejected or a cold dev server was still compiling
  // the verify route and the destination (each probe starts fresh servers).
  const left = page
    .waitForURL((url) => !url.pathname.endsWith("/login"), {
      timeout: LOGIN_EXIT_TIMEOUT_MS,
      waitUntil: "commit",
    })
    .then(() => "left" as const);
  const rejected = page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('[role="alert"]')].some(
          (alert) => alert.className.includes("fba-red-tx") && alert.textContent?.trim(),
        ),
      undefined,
      { timeout: LOGIN_EXIT_TIMEOUT_MS },
    )
    .then(
      () => "rejected" as const,
      // A successful login navigates away, which destroys this check's execution
      // context. That must never decide the race, so a failed check never settles.
      () => new Promise<never>(() => undefined),
    );
  // If `rejected` wins, `left` keeps waiting until its timeout; keep that rejection quiet.
  left.catch(() => undefined);

  const outcome = await Promise.race([left, rejected]).catch(() => "stalled" as const);
  if (outcome === "rejected") {
    const message = await page.getByRole("alert").first().innerText();
    throw new Error(`Login was rejected and stayed on /login: ${message}`);
  }
  if (outcome === "stalled") {
    throw new Error(
      `Login did not leave /login within ${String(LOGIN_EXIT_TIMEOUT_MS / 1000)} s and showed no error.`,
    );
  }
}
