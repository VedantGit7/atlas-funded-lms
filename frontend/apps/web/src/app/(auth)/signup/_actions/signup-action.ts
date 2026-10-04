"use server";

import { withSignupCompleteMarker } from "../../../../features/marketing/snippet-scope";
import { redirect } from "next/navigation";
import { PublicSignupRequestSchema } from "@atlas/contracts/domain-identity/schemas/public-auth";
import { GENERIC_SIGNUP_ERROR_MESSAGE } from "../../../../lib/auth-messages";
import { readFormString } from "../../../../lib/server/form";
import { serverPublicApi, ServerPublicApiError } from "../../../../lib/server/public-auth-fetch";
import { resolveTenantEmailRedirect } from "../../../../lib/server/tenant-email-redirect";

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
    password: readFormString(formData.get("password")),
    displayName: readFormString(formData.get("displayName")),
    ...(inviteToken ? { inviteToken } : {}),
    ...(referralCode ? { referralCode } : {}),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Check your details and try again.",
      requestId,
    };
  }

  try {
    const { email, password, displayName, inviteToken, referralCode } = parsed.data;
    const emailRedirectTo = await resolveTenantEmailRedirect();
    const body = await serverPublicApi.signup({
      email,
      password,
      displayName,
      ...(inviteToken ? { inviteToken } : {}),
      ...(referralCode ? { referralCode } : {}),
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
    });

    if (body.data.status === "EMAIL_VERIFICATION_REQUIRED") {
      return {
        ok: true,
        message: "Check your email to verify your account before signing in.",
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
