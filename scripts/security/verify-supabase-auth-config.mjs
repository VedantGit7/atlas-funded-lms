#!/usr/bin/env node
// Verifies the hosted Supabase project's Auth settings against audit H6.
//
// `supabase/config.toml` only configures the local stack. The hosted project is
// set in the dashboard, where a toggle can drift without a code change, so run
// this before each production deploy (see docs/runbooks/identity-and-account-review.md):
//
//   SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... node scripts/security/verify-supabase-auth-config.mjs
//
// The token is a personal access token with read access to the project. It is
// sent only to api.supabase.com and never printed.

const MANAGEMENT_API = "https://api.supabase.com/v1/projects";
export const REQUIRED_MIN_PASSWORD_LENGTH = 10;

/**
 * @param {Record<string, unknown>} config Management API `GET /config/auth` body.
 * @param {{ requireHibp?: boolean }} [options]
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function evaluateSupabaseAuthConfig(config, options = {}) {
  const errors = [];
  const warnings = [];

  if (config["mailer_autoconfirm"] !== false) {
    errors.push(
      "Email confirmations are off (mailer_autoconfirm). Turn on Authentication → Sign In / Providers → Email → Confirm email.",
    );
  }

  const minLength = Number(config["password_min_length"]);
  if (!Number.isInteger(minLength) || minLength < REQUIRED_MIN_PASSWORD_LENGTH) {
    errors.push(
      `Minimum password length is ${String(config["password_min_length"])}; set it to at least ${String(REQUIRED_MIN_PASSWORD_LENGTH)}.`,
    );
  }

  if (config["security_update_password_require_reauthentication"] !== true) {
    errors.push(
      "Secure password change is off (security_update_password_require_reauthentication). Turn it on.",
    );
  }

  if (config["password_hibp_enabled"] !== true) {
    const message =
      "Supabase leaked-password protection is off (password_hibp_enabled). The application still checks breached passwords itself; turn this on when the plan allows it.";
    if (options.requireHibp) errors.push(message);
    else warnings.push(message);
  }

  return { errors, warnings };
}

async function main() {
  const token = process.env["SUPABASE_ACCESS_TOKEN"]?.trim();
  const projectRef = process.env["SUPABASE_PROJECT_REF"]?.trim();
  const requireHibp = process.argv.includes("--require-hibp");

  if (!token || !projectRef) {
    console.error("SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required.");
    process.exit(2);
  }
  if (!/^[a-z0-9]{20}$/.test(projectRef)) {
    console.error("SUPABASE_PROJECT_REF must be the 20-character project reference.");
    process.exit(2);
  }

  const response = await fetch(`${MANAGEMENT_API}/${projectRef}/config/auth`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    console.error(`Supabase Management API returned ${String(response.status)}.`);
    process.exit(2);
  }

  const { errors, warnings } = evaluateSupabaseAuthConfig(
    /** @type {Record<string, unknown>} */ (await response.json()),
    { requireHibp },
  );

  for (const warning of warnings) console.warn(`warning: ${warning}`);
  for (const error of errors) console.error(`error: ${error}`);

  if (errors.length > 0) {
    console.error(
      `\nSupabase Auth for ${projectRef} does not meet the identity policy (audit H6).`,
    );
    process.exit(1);
  }
  console.log(`Supabase Auth for ${projectRef} meets the identity policy (audit H6).`);
}

// Run only as a CLI, so tests can import the evaluator without a network call.
if (process.argv[1]?.endsWith("verify-supabase-auth-config.mjs")) {
  await main();
}
