import { createHash } from "node:crypto";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { structuredLogger } from "@atlas/observability/logger";
import { PASSWORD_POLICY_REJECTION_MESSAGE } from "./auth-errors";

/**
 * Policy for a password being *set*: signup, reset, change, invitation (audit
 * H6). Sign-in never applies it, so an older, shorter password still signs in
 * until its owner changes it.
 *
 * The same minimum is configured in Supabase Auth (`supabase/config.toml`
 * locally, verified on the hosted project by
 * `scripts/security/verify-supabase-auth-config.mjs`). It is repeated here
 * because the hosted setting is a dashboard toggle that can drift, and because
 * Supabase's own leaked-password check needs a paid plan.
 */
export const NEW_PASSWORD_MIN_LENGTH = 10;

const PWNED_PASSWORDS_RANGE_URL = "https://api.pwnedpasswords.com/range/";
const BREACH_CHECK_TIMEOUT_MS = 3_000;

export type PasswordBreachCheckMode = "enforce" | "off";

/**
 * `PASSWORD_BREACH_CHECK=off` disables the lookup. It defaults to off only in
 * the test runtime, where no request may leave the machine; the deployment
 * contract refuses `off` in deployed environments.
 */
export function readPasswordBreachCheckMode(
  env: Record<string, string | undefined> = process.env,
): PasswordBreachCheckMode {
  const configured = env["PASSWORD_BREACH_CHECK"]?.trim().toLowerCase();
  if (configured === "off") return "off";
  if (configured === "enforce") return "enforce";
  return env["NODE_ENV"] === "test" || env["APP_ENV"] === "test" ? "off" : "enforce";
}

export function breachedPasswordRejection(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: PASSWORD_POLICY_REJECTION_MESSAGE,
  });
}

/**
 * True when the password appears in the Have I Been Pwned corpus.
 *
 * k-anonymity: only the first five hex characters of the SHA-1 leave the
 * server, and `Add-Padding` makes every response the same size, so neither
 * the service nor an observer learns the password or whether it matched.
 *
 * Fails open. An unreachable lookup must not stop people from signing up or
 * resetting a password; the length rule still applies, and the failure is
 * logged so a sustained outage is visible.
 */
export async function isPasswordBreached(
  password: string,
  options: { fetchImpl?: typeof fetch; mode?: PasswordBreachCheckMode } = {},
): Promise<boolean> {
  const mode = options.mode ?? readPasswordBreachCheckMode();
  if (mode === "off") return false;

  const digest = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(`${PWNED_PASSWORDS_RANGE_URL}${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "atlas-lms-password-policy" },
      signal: AbortSignal.timeout(BREACH_CHECK_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`range lookup returned ${String(response.status)}`);
    }

    const body = await response.text();
    for (const line of body.split("\n")) {
      const [candidate, count] = line.trim().split(":");
      // Padding rows carry a count of 0 and never mean "breached".
      if (candidate === suffix && Number(count) > 0) return true;
    }
    return false;
  } catch (error) {
    structuredLogger.warn({
      message: "Password breach lookup unavailable; accepted on length policy only",
      module: "auth.password-policy",
      eventType: "auth.password_breach_check_unavailable",
      errorCode: error instanceof Error ? error.name : "unknown",
    });
    return false;
  }
}

/** Throws the generic policy rejection for a password known to be breached. */
export async function assertPasswordNotBreached(
  password: string,
  options?: { fetchImpl?: typeof fetch; mode?: PasswordBreachCheckMode },
): Promise<void> {
  if (await isPasswordBreached(password, options)) {
    throw breachedPasswordRejection();
  }
}
