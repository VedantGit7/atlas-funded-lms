import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { REQUIRED_BROWSER_JOURNEYS } from "../browser/journeys-registry";

/**
 * The browser journeys must actually run somewhere.
 *
 * `journeys-registry.ts` maps the eleven journeys the frontend architecture
 * requires to their specs, and all eleven existed. Ten of them ran nowhere:
 *
 * - CI invoked one spec by name plus the accessibility directory, so eight
 *   journeys were never launched at all;
 * - the ten authenticated journeys guard themselves with `test.skip` when no
 *   credentials are set, and nothing ever set them, so even the invoked ones
 *   would have skipped;
 * - and no job added the hosts entries the tenant base URLs need, so every
 *   navigation would have failed to resolve.
 *
 * Three independent reasons for the same outcome, none of them visible in a
 * green run. This asserts all three are closed, because presence is what gets
 * checked and presence is exactly what was never the problem.
 */

const repoRoot = resolve(import.meta.dirname, "..", "..");
const workflowDir = join(repoRoot, ".github", "workflows");

function allWorkflowText(): string {
  return readdirSync(workflowDir)
    .filter((file) => /\.ya?ml$/.test(file))
    .map((file) => readFileSync(join(workflowDir, file), "utf8"))
    .join("\n");
}

const workflows = allWorkflowText();

describe("browser journey wiring", () => {
  it("reads the workflows it is meant to be checking", () => {
    // Guards the guard: an empty read makes every assertion below vacuous.
    expect(workflows.length).toBeGreaterThan(1000);
    expect(workflows).toContain("playwright");
  });

  it("has a spec file for every required journey", () => {
    const missing = REQUIRED_BROWSER_JOURNEYS.filter(
      (journey) => !existsSync(join(repoRoot, "tests", "browser", journey.spec)),
    );
    expect(missing.map((journey) => journey.id)).toEqual([]);
  });

  it("runs the whole suite rather than a hand-listed subset", () => {
    // The previous command named `journeys/01-…` and `accessibility`, so adding
    // a twelfth journey would have left it running nowhere by default. A bare
    // `playwright test` picks up whatever the registry grows.
    expect(workflows).toMatch(/run: pnpm exec playwright test\s*$/m);
    expect(workflows).not.toContain("playwright test tests/browser/journeys/01");
  });

  it("resolves the tenant hosts the base URLs depend on", () => {
    // `.test` is a reserved TLD that no resolver answers for, so without these
    // every page.goto fails with ERR_NAME_NOT_RESOLVED.
    //
    // These are the dev-fixture hostnames from playwright.config.ts, which
    // carries the same exemption: test-harness configuration, not a brand name
    // reaching into product code.
    /* eslint-disable atlas/no-hardcoded-tenant-strings */
    expect(workflows).toContain("fundedbeyond.localhost.test");
    expect(workflows).toContain("second-smoke.localhost.test");
    /* eslint-enable atlas/no-hardcoded-tenant-strings */
    expect(workflows).toContain("/etc/hosts");
  });

  it("seeds the tenants those hosts must resolve to", () => {
    // Applied, not planned: the seed runner defaults to dry-run, so a step that
    // looks successful can insert nothing and leave every host resolving to no
    // tenant.
    expect(workflows).toContain("tenant-config:apply");
    expect(workflows).toContain("--apply");
  });

  it("seeds the users the authenticated journeys log in as", () => {
    expect(workflows).toContain("scripts/e2e/seed-browser-users.mjs");
  });

  it("fails rather than skips when credentials are missing", () => {
    // The heart of it. Ten journeys skip without credentials, and Playwright
    // reports a skipped test as a passing job — so an unconfigured pipeline
    // looked identical to a covered one.
    expect(workflows).toContain("E2E_REQUIRE_AUTH_JOURNEYS");
  });

  it("passes the Supabase configuration the login flow needs", () => {
    // Login goes through Supabase signInWithPassword; without these the seeded
    // users cannot authenticate and every journey fails at the login form.
    for (const variable of [
      "SUPABASE_SERVICE_ROLE_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "E2E_SEED_PASSWORD",
    ]) {
      expect(workflows).toContain(variable);
    }
  });

  it("starts the auth stack it points those variables at", () => {
    // Configuration without a server is the gap this caught once already: the
    // local stack was added and verified, the workflow kept pointing at a hosted
    // project's secrets, and nothing failed because the variables were present.
    // Naming an endpoint is not the same as running one.
    expect(workflows).toContain("supabase start");
  });

  it("excludes the screenshot comparisons deliberately, not by omission", () => {
    // Every baseline is a -win32.png and the runner is Linux, so Playwright
    // would write a new baseline and pass without comparing anything. The
    // exclusion is a named flag rather than a shortened command, so it stays
    // visible and the whole-suite invocation above still holds.
    expect(workflows).toContain("BROWSER_E2E_SKIP_VISUAL");
  });

  it("does not reintroduce a hosted Supabase dependency", () => {
    // A fork cannot supply repository secrets, and a suite only the owner can
    // run is most of the way back to a suite nobody runs.
    expect(workflows).not.toMatch(/secrets\.E2E_SUPABASE/);
  });
});

describe("the skip guard is opt-in, not tied to CI", () => {
  const envHelper = readFileSync(join(repoRoot, "tests", "browser", "helpers", "env.ts"), "utf8");

  it("throws when credentials are required and absent", () => {
    expect(envHelper).toContain("E2E_REQUIRE_AUTH_JOURNEYS");
    expect(envHelper).toContain("throw new Error");
  });

  it("does not force a fork or a contributor to have seeded users", () => {
    // Keying off CI itself would break every fork's pipeline, which is why the
    // requirement is its own flag that the repository's workflow opts into.
    expect(envHelper).not.toMatch(/process\.env\[["']CI["']\]/);
  });

  it("names the variable that is missing", () => {
    // "Skipped: set the credentials" in a log nobody reads is how this went
    // unnoticed; the failure has to say which variable and how to get it.
    expect(envHelper).toContain("e2e:seed-users");
  });
});
