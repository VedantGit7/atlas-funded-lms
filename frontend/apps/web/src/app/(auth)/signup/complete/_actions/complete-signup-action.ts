"use server";

import { PASSWORD_POLICY_REJECTION_MESSAGE } from "@atlas/auth/auth-errors";
import { PublicSignupCompleteRequestSchema } from "@atlas/contracts/domain-identity/schemas/public-auth";
import { withSignupCompleteMarker } from "../../../../../features/marketing/snippet-scope";
import { resolvePostAuthRedirect } from "../../../../../lib/auth/safe-redirect";
import { readFormString } from "../../../../../lib/server/form";
import { ServerPublicApiError, serverPublicApi } from "../../../../../lib/server/public-auth-fetch";

export type CompleteSignupActionState = {
  ok: boolean;
  message: string;
  requestId: string;
  /** Where the browser goes next, signed in. */
  destination?: string;
};

const COMPLETE_FAILED_MESSAGE = "We couldn't finish creating your account. Please try again.";
const LINK_INVALID_MESSAGE =
  "This sign-up link is invalid or has expired. Sign up again to get a new one.";

/**
 * Finishes a sign-up from its emailed link (security review 5.3, finding 1):
 * the API creates the account, verified, with this password, and sets the
 * session cookie, which postJson passes on to the browser.
 */
export async function completeSignupAction(
  _prev: CompleteSignupActionState | null,
  formData: FormData,
): Promise<CompleteSignupActionState> {
  const requestId = crypto.randomUUID();
  const parsed = PublicSignupCompleteRequestSchema.safeParse({
    token: readFormString(formData.get("token")),
    password: readFormString(formData.get("password")),
  });

  if (!parsed.success) {
    if (parsed.error.issues.some((issue) => issue.path[0] === "token")) {
      return { ok: false, message: LINK_INVALID_MESSAGE, requestId };
    }
    return { ok: false, message: "Password must be 10 to 128 characters.", requestId };
  }

  let body: Awaited<ReturnType<typeof serverPublicApi.completeSignup>>;
  try {
    body = await serverPublicApi.completeSignup(parsed.data);
  } catch (error) {
    if (error instanceof ServerPublicApiError) {
      const message =
        error.code === "VALIDATION_ERROR" && error.message === PASSWORD_POLICY_REJECTION_MESSAGE
          ? PASSWORD_POLICY_REJECTION_MESSAGE
          : error.code === "AUTH_REQUIRED"
            ? LINK_INVALID_MESSAGE
            : error.code === "ALREADY_MEMBER" || error.code === "RATE_LIMITED"
              ? error.message
              : COMPLETE_FAILED_MESSAGE;
      return { ok: false, message, requestId: error.requestId };
    }
    return { ok: false, message: COMPLETE_FAILED_MESSAGE, requestId };
  }

  const target = resolvePostAuthRedirect(null, body.data.redirectTo, "/") ?? "/";
  // A finished sign-up: tag the destination so the academy's signup-tracking
  // snippet fires there, not on this page. An invitation opens untagged.
  const destination = target.startsWith("/invite/") ? target : withSignupCompleteMarker(target);
  return { ok: true, message: "", requestId, destination };
}
