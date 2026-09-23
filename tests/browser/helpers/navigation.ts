/** Cold dev-route compilation can exceed the normal outcome assertion timeout.
 * Use only for navigation; saved-state assertions and the whole-test limit stay unchanged.
 */
export function coldRouteNavigationOptions(): { timeout?: number } {
  return process.env["BROWSER_E2E_DEV"] === "1" ? { timeout: 60_000 } : {};
}
