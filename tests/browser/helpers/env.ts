/**
 * Credential plumbing for the authenticated browser journeys.
 *
 * Ten of the eleven journeys in `journeys-registry.ts` need a logged-in user.
 * They guard themselves with `test.skip(!hasXCredentials(), …)`, which is right
 * for a laptop — a contributor without seeded users should still be able to run
 * the public journeys.
 *
 * It was wrong for CI, and that is what made this suite worthless there: with no
 * credentials configured the ten journeys skipped, the run went green, and the
 * absence of coverage was indistinguishable from coverage. Playwright reports a
 * skip as a pass at the job level.
 *
 * So skipping is now a local convenience only. Setting
 * `E2E_REQUIRE_AUTH_JOURNEYS=1` — which CI does — turns a missing credential
 * into a hard failure naming the variable, so a misconfigured pipeline says so
 * instead of quietly testing nothing.
 */

/** Every credential pair the journeys can require, with the role it unlocks. */
const CREDENTIAL_SETS = {
  learner: ["E2E_LEARNER_EMAIL", "E2E_LEARNER_PASSWORD"],
  instructor: ["E2E_INSTRUCTOR_EMAIL", "E2E_INSTRUCTOR_PASSWORD"],
  admin: ["E2E_ADMIN_EMAIL", "E2E_ADMIN_PASSWORD"],
  platform: ["E2E_PLATFORM_EMAIL", "E2E_PLATFORM_PASSWORD"],
} as const;

export type CredentialRole = keyof typeof CREDENTIAL_SETS;

export const REQUIRE_AUTH_JOURNEYS_ENV = "E2E_REQUIRE_AUTH_JOURNEYS";

/**
 * Whether an unconfigured journey must fail rather than skip.
 *
 * Deliberately its own flag rather than keying off `CI`: a fork or a
 * contributor's pipeline may legitimately have no seeded users, and should not
 * be forced to fail. The repository's own workflow opts in.
 */
export function authJourneysRequired(): boolean {
  return process.env[REQUIRE_AUTH_JOURNEYS_ENV] === "1";
}

function missingVariables(role: CredentialRole): string[] {
  return CREDENTIAL_SETS[role].filter((name) => !process.env[name]?.trim());
}

function hasCredentials(role: CredentialRole): boolean {
  const missing = missingVariables(role);
  if (missing.length === 0) return true;

  if (authJourneysRequired()) {
    throw new Error(
      `${REQUIRE_AUTH_JOURNEYS_ENV}=1 but ${missing.join(" and ")} ${
        missing.length === 1 ? "is" : "are"
      } not set. ` +
        `The ${role} journeys would skip, which reads as a pass and proves nothing. ` +
        `Seed the users with "pnpm e2e:seed-users" and pass the credentials through, ` +
        `or unset ${REQUIRE_AUTH_JOURNEYS_ENV} to allow skipping.`,
    );
  }

  return false;
}

/**
 * Reads a required credential, failing with the variable name if it is missing.
 *
 * The journey specs used `process.env["E2E_LEARNER_EMAIL"]!` — the non-null
 * assertion silenced the type error but passed `undefined` straight into the
 * login helper, so a missing variable surfaced as an opaque login failure
 * rather than a configuration error. The `has*Credentials` guards above are
 * what decide whether a spec runs; by the time this is called the value must
 * exist, and if it does not the test should say so.
 */
export function requiredCredential(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be set to run this browser journey.`);
  }
  return value;
}

export function hasLearnerCredentials(): boolean {
  return hasCredentials("learner");
}

export function hasInstructorCredentials(): boolean {
  return hasCredentials("instructor");
}

export function hasAdminCredentials(): boolean {
  return hasCredentials("admin");
}

export function hasPlatformCredentials(): boolean {
  return hasCredentials("platform");
}

export function secondTenantBaseUrl(): string {
  return process.env["E2E_SECOND_TENANT_BASE_URL"] ?? "http://second-smoke.localhost.test:3000";
}
