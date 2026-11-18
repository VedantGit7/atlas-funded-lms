"use server";

import { PublicJoinRequestSchema } from "@atlas/contracts/domain-identity/schemas/public-auth";
import {
  resolvePostAuthRedirect,
  resolveSafeRedirectPath,
} from "../../../../lib/auth/safe-redirect";
import { loginFailureMessage } from "../../../../lib/auth-messages";
import { readFormString } from "../../../../lib/server/form";
import { ServerPublicApiError, serverPublicApi } from "../../../../lib/server/public-auth-fetch";

export type JoinActionState = {
  ok: boolean;
  message: string;
  requestId: string;
  /** Set on success; the client performs a full navigation (see LoginForm). */
  destination?: string;
  /** The session ended or never existed: the person signs in first. */
  signInRequired?: boolean;
};

const TERMS_REQUIRED_MESSAGE = "Tick the box to agree to the Terms and Privacy Policy.";
const GENERIC_FAILURE_MESSAGE = "Something went wrong. Please try again.";

/**
 * Agrees to this academy's Terms and Privacy Policy as someone already signed
 * in, which opens their membership (launch plan 5.7).
 */
export async function joinAction(
  _prev: JoinActionState | null,
  formData: FormData,
): Promise<JoinActionState> {
  const requestId = crypto.randomUUID();
  const next = resolveSafeRedirectPath(readFormString(formData.get("next")));
  const parsed = PublicJoinRequestSchema.safeParse({
    acceptTerms: readFormString(formData.get("acceptTerms")) === "true",
  });
  if (!parsed.success) return { ok: false, message: TERMS_REQUIRED_MESSAGE, requestId };

  try {
    const body = await serverPublicApi.join({ acceptTerms: true });
    switch (body.data.status) {
      case "AUTHENTICATED":
        return {
          ok: true,
          message: "",
          requestId,
          destination: resolvePostAuthRedirect(next, body.data.redirectTo, "/") ?? "/",
        };
      case "INVITED_MEMBERSHIP":
        return { ok: true, message: "", requestId, destination: "/invite/accept" };
      default:
        return {
          ok: false,
          message: "You don't have access to this academy. Contact the academy for help.",
          requestId,
        };
    }
  } catch (error) {
    if (error instanceof ServerPublicApiError) {
      if (error.status === 401) {
        return {
          ok: false,
          message: "Your session has ended. Sign in again to continue.",
          requestId: error.requestId || requestId,
          signInRequired: true,
        };
      }
      return {
        ok: false,
        message: loginFailureMessage(error.status) ?? GENERIC_FAILURE_MESSAGE,
        requestId: error.requestId || requestId,
      };
    }
    return { ok: false, message: GENERIC_FAILURE_MESSAGE, requestId };
  }
}
