"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabasePublicServerClient } from "@atlas/auth/supabase-server";
import { PASSWORD_POLICY_REJECTION_MESSAGE } from "@atlas/auth/auth-errors";
import {
  PublicPasswordResetCompleteSchema,
  PublicPasswordResetRequestSchema,
  type PublicPasswordResetCompleteResponse,
} from "@atlas/contracts/domain-identity/schemas/public-auth";
import { GENERIC_PASSWORD_RESET_MESSAGE } from "../../../../lib/auth-messages";
import { readFormString } from "../../../../lib/server/form";
import { ServerPublicApiError, serverPublicApi } from "../../../../lib/server/public-auth-fetch";
import { resolveRequestOriginFromHeaders } from "../../../../lib/server/resolve-request-origin";

export type ResetPasswordActionState = {
  ok: boolean;
  message: string;
  requestId: string;
  /** The account has MFA: the form must ask for an authenticator code. */
  mfaRequired?: boolean;
};

const MFA_REQUIRED_MESSAGE =
  "Your account uses two-step verification. Enter the 6-digit code from your authenticator app to finish.";
const MFA_INVALID_MESSAGE = "That code didn't work. Check your authenticator app and try again.";
const RESET_FAILED_MESSAGE = "Unable to reset password. Request a new link.";

async function getRequestOrigin(): Promise<string> {
  const headerList = await headers();
  return resolveRequestOriginFromHeaders(headerList);
}

export async function requestPasswordResetAction(
  _prev: ResetPasswordActionState | null,
  formData: FormData,
): Promise<ResetPasswordActionState> {
  const requestId = crypto.randomUUID();
  const parsed = PublicPasswordResetRequestSchema.safeParse({
    email: readFormString(formData.get("email")),
  });

  if (!parsed.success) {
    return { ok: false, message: "Enter a valid email address.", requestId };
  }

  try {
    const supabase = createSupabasePublicServerClient();
    const origin = await getRequestOrigin();

    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${origin}/reset-password`,
    });
  } catch {
    // Always return generic success to avoid email enumeration.
  }

  return { ok: true, message: GENERIC_PASSWORD_RESET_MESSAGE, requestId };
}

export async function completePasswordResetAction(
  _prev: ResetPasswordActionState | null,
  formData: FormData,
): Promise<ResetPasswordActionState> {
  const requestId = crypto.randomUUID();
  const parsed = PublicPasswordResetCompleteSchema.safeParse({
    password: readFormString(formData.get("password")),
    accessToken: readFormString(formData.get("accessToken")),
    refreshToken: readFormString(formData.get("refreshToken")),
    mfaCode: readFormString(formData.get("mfaCode")),
  });

  if (!parsed.success) {
    if (parsed.error.issues.some((issue) => issue.path[0] === "mfaCode")) {
      return { ok: false, mfaRequired: true, message: MFA_INVALID_MESSAGE, requestId };
    }
    return { ok: false, message: "Password must be at least 10 characters.", requestId };
  }

  if (!parsed.data.accessToken) {
    return { ok: false, message: "Reset link is invalid or expired.", requestId };
  }

  // The API checks the password against breaches (audit H6), asks an account
  // with MFA for its authenticator code (the recovery link signs in at aal1),
  // and sends the "password changed" security email.
  let status: PublicPasswordResetCompleteResponse["data"]["status"];
  try {
    const body = await serverPublicApi.resetPassword({
      password: parsed.data.password,
      accessToken: parsed.data.accessToken,
      refreshToken: parsed.data.refreshToken,
      mfaCode: parsed.data.mfaCode || undefined,
    });
    status = body.data.status;
  } catch (error) {
    if (error instanceof ServerPublicApiError) {
      return {
        ok: false,
        message:
          error.code === "VALIDATION_ERROR" && error.message === PASSWORD_POLICY_REJECTION_MESSAGE
            ? PASSWORD_POLICY_REJECTION_MESSAGE
            : error.code === "AUTH_REQUIRED"
              ? "Reset link is invalid or expired."
              : RESET_FAILED_MESSAGE,
        requestId: error.requestId,
      };
    }
    return { ok: false, message: RESET_FAILED_MESSAGE, requestId };
  }

  if (status === "MFA_REQUIRED") {
    return { ok: false, mfaRequired: true, message: MFA_REQUIRED_MESSAGE, requestId };
  }
  if (status === "MFA_INVALID") {
    return { ok: false, mfaRequired: true, message: MFA_INVALID_MESSAGE, requestId };
  }

  redirect("/login");
}

export async function clearRecoverySessionAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("atlas_access_token");
  cookieStore.delete("atlas_refresh_token");
}
