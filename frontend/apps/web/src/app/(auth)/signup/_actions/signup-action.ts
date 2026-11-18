"use server";

import { withSignupCompleteMarker } from "../../../../features/marketing/snippet-scope";
import { redirect } from "next/navigation";
import { PublicSignupRequestSchema } from "@atlas/contracts/domain-identity/schemas/public-auth";
import { GENERIC_SIGNUP_ERROR_MESSAGE } from "../../../../lib/auth-messages";
import { readFormString } from "../../../../lib/server/form";
import { serverPublicApi, ServerPublicApiError } from "../../../../lib/server/public-auth-fetch";

export type SignupActionState = {
  ok: boolean;
  message: string;
  requestId: string;
  verificationRequired?: boolean;
  /** Echoed back (only when verification is required) so the UI can route to
   * the verify-email screen with the address prefilled. */
  email?: string;
};

export async function signupAction(
  _prev: SignupActionState | null,
  formData: FormData,
): Promise<SignupActionState> {
  const requestId = crypto.randomUUID();
  const inviteToken = readFormString(formData.get("inviteToken")).trim();
  const referralCode = readFormString(formData.get("referralCode")).trim();
  const parsed = PublicSignupRequestSchema.safeParse({
    email: readFormString(formData.get("email")),
    displayName: readFormString(formData.get("displayName")),
    acceptTerms: readFormString(formData.get("acceptTerms")) === "true",
    ...(inviteToken ? { inviteToken } : {}),
    ...(referralCode ? { referralCode } : {}),
  });

  if (!parsed.success) {
    const termsMissing = parsed.error.issues.some((issue) => issue.path[0] === "acceptTerms");
    return {
      ok: false,
      message: termsMissing
        ? "Tick the box to agree to the Terms and Privacy Policy."
        : "Check your details and try again.",
      requestId,
    };
  }

  try {
    // The emailed link finishes the sign-up, where the password is chosen
    // (security review 5.3, finding 1).
    const { email, displayName, inviteToken, referralCode } = parsed.data;
    const body = await serverPublicApi.signup({
      email,
      displayName,
      acceptTerms: true,
      ...(inviteToken ? { inviteToken } : {}),
      ...(referralCode ? { referralCode } : {}),
    });

    if (body.data.status === "EMAIL_VERIFICATION_REQUIRED") {
      return {
        ok: true,
        message: "Check your email for the link to finish creating your account.",
        requestId,
        verificationRequired: true,
        email,
      };
    }

    if (parsed.data.inviteToken) {
      redirect(`/invite/accept?token=${encodeURIComponent(parsed.data.inviteToken)}`);
    }

    if (body.data.redirectTo) {
      // Signup tracking fires on the page this lands on, never on the signup form.
      redirect(withSignupCompleteMarker(body.data.redirectTo));
    }

    redirect("/login");
  } catch (error) {
    if (error instanceof ServerPublicApiError) {
      return {
        ok: false,
        message: error.message,
        requestId: error.requestId || requestId,
      };
    }

    return {
      ok: false,
      message: GENERIC_SIGNUP_ERROR_MESSAGE,
      requestId,
    };
  }
}
