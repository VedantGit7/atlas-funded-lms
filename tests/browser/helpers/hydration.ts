import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Wait until React has taken over the server-rendered HTML.
 *
 * The journeys drive a progressively-enhanced app. Until React attaches, the
 * login form submits natively: the server re-renders /login, the client-side
 * navigation that the action's response triggers never runs, and the test sits
 * on the login page until it times out. Nothing throws, so the failure reads as
 * "login is broken" rather than "the test clicked too early".
 *
 * `load` and `networkidle` are both far too early to use as a proxy. Measured
 * against the Turbopack dev server in Playwright's Chromium, this route was
 * still unhydrated at ten seconds and hydrated by twenty — the dev server
 * compiles the client chunks on demand, and the first visit to a route pays for
 * it. A real browser on the same URL hydrates in about a second, which is why
 * this never showed up in manual testing.
 *
 * So: poll for the real thing rather than guess a duration.
 */

/** How long to allow for a cold dev-server compile plus hydration. */
const HYDRATION_TIMEOUT_MS = 60_000;

/**
 * React attaches `__reactFiber$…` / `__reactProps$…` to the host nodes it owns.
 * These are internals rather than public API, but they are the only direct
 * evidence that hydration has completed; every public alternative — a visible
 * element, a network state — is satisfied by the server-rendered HTML alone and
 * so cannot distinguish "rendered" from "interactive", which is exactly the
 * distinction that matters here.
 */
export async function waitForHydration(
  page: Page,
  timeoutMs: number = HYDRATION_TIMEOUT_MS,
): Promise<void> {
  await page.waitForFunction(
    () =>
      document.body !== null && Object.keys(document.body).some((key) => key.startsWith("__react")),
    undefined,
    { timeout: timeoutMs },
  );
}

/**
 * Body hydration can precede a streamed client boundary. Before a critical
 * client-only action, require its own handler instead of treating the body
 * marker as proof that every descendant is interactive. This does not click,
 * retry an action, or replace the journey's visible/persisted outcome checks.
 */
export async function waitForClickHandler(
  control: Locator,
  timeoutMs: number = HYDRATION_TIMEOUT_MS,
): Promise<void> {
  await expect
    .poll(
      () =>
        control.evaluate(
          (element) =>
            Object.keys(element).some((key) => {
              if (!key.startsWith("__reactProps$")) return false;
              const props = (element as unknown as Record<string, unknown>)[key];
              return (
                props !== null &&
                typeof props === "object" &&
                "onClick" in props &&
                typeof props.onClick === "function"
              );
            }),
          undefined,
          { timeout: Math.min(timeoutMs, 1_000) },
        ),
      { timeout: timeoutMs, message: "The control's React click handler must be ready" },
    )
    .toBe(true);
}
