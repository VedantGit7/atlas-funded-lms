"use server";

import { redirect } from "next/navigation";
import { PASSWORD_POLICY_REJECTION_MESSAGE } from "@atlas/auth/auth-errors";
import {
  PublicPasswordResetCompleteSchema,
  PublicPasswordResetRequestSchema,
} from "@atlas/contracts/domain-identity/schemas/public-auth";
import { GENERIC_PASSWORD_RESET_MESSAGE } from "../../../../lib/auth-messages";
import { readFormString } from "../../../../lib/server/form";
import { ServerPublicApiError, serverPublicApi } from "../../../../lib/server/public-auth-fetch";

export type ResetPasswordActionState = {
  ok: boolean;
  message: string;
  requestId: string;
};

const RESET_FAILED_MESSAGE = "Unable to reset password. Request a new link.";

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
    // The API sends the link, from the academy.
    await serverPublicApi.forgotPassword({ email: parsed.data.email });
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
  // The link carries a single-use token (launch plan task 3.2).
  const parsed = PublicPasswordResetCompleteSchema.safeParse({
    password: readFormString(formData.get("password")),
    token: readFormString(formData.get("token")),
  });

  if (!parsed.success) {
    if (parsed.error.issues.some((issue) => issue.path[0] === "token")) {
      return { ok: false, message: "Reset link is invalid or expired.", requestId };
    }
    return { ok: false, message: "Password must be at least 10 characters.", requestId };
  }

  // The API checks the password against breaches (audit H6), ends every
  // session, and sends the "password changed" security email. An account with
  // MFA still needs its code at the next sign-in.
  try {
    await serverPublicApi.resetPassword({
      password: parsed.data.password,
      token: parsed.data.token,
    });
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

  redirect("/login");
}
