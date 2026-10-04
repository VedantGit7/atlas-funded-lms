"use server";

import { PublicLoginRequestSchema } from "@atlas/contracts/domain-identity/schemas/public-auth";
import {
  resolvePostAuthRedirect,
  resolveSafeRedirectPath,
} from "../../../../lib/auth/safe-redirect";
import { GENERIC_LOGIN_ERROR_MESSAGE, identityBlockMessage } from "../../../../lib/auth-messages";
import { readFormString } from "../../../../lib/server/form";
import { serverPublicApi, ServerPublicApiError } from "../../../../lib/server/public-auth-fetch";

export type LoginActionState = {
  ok: boolean;
  message: string;
  requestId: string;
  mfaRequired?: boolean;
  redirectTo?: string;
  destination?: string;
};

export async function loginAction(
  _prev: LoginActionState | null,
  formData: FormData,
): Promise<LoginActionState> {
  const requestId = crypto.randomUUID();
  const redirectTo = readFormString(formData.get("redirectTo")).trim();
  const rememberMe = readFormString(formData.get("rememberMe")) === "true";
  const parsed = PublicLoginRequestSchema.safeParse({
    email: readFormString(formData.get("email")),
    password: readFormString(formData.get("password")),
    rememberMe,
    ...(redirectTo ? { redirectTo } : {}),
  });

  if (!parsed.success) {
    return { ok: false, message: GENERIC_LOGIN_ERROR_MESSAGE, requestId };
  }

  const clientRedirect = resolveSafeRedirectPath(parsed.data.redirectTo);

  let body: Awaited<ReturnType<typeof serverPublicApi.login>>;

  try {
    body = await serverPublicApi.login(parsed.data);
  } catch (error) {
    // Only reached after the password was accepted, so naming the account
    // state reveals nothing a wrong password could learn (audit H6).
    const identityMessage =
      error instanceof ServerPublicApiError ? identityBlockMessage(error.code) : null;
    return {
      ok: false,
      message: identityMessage ?? GENERIC_LOGIN_ERROR_MESSAGE,
      requestId:
        identityMessage && error instanceof ServerPublicApiError ? error.requestId : requestId,
    };
  }

  if (body.data.status === "MFA_REQUIRED") {
    return {
      ok: false,
      message: "Multi-factor authentication is required to continue.",
      requestId,
      mfaRequired: true,
      ...(clientRedirect ? { redirectTo: clientRedirect } : {}),
    };
  }

  if (body.data.status === "INVITED_MEMBERSHIP") {
    const destination = resolvePostAuthRedirect(
      clientRedirect,
      body.data.redirectTo,
      "/invite/accept",
    );
    return {
      ok: true,
      message: "Signed in.",
      requestId,
      destination: destination ?? "/invite/accept",
    };
  }

  if (body.data.status === "NO_ACTIVE_MEMBERSHIP") {
    return {
      ok: false,
      message: "You do not have active access to this academy.",
      requestId,
    };
  }

  const destination = resolvePostAuthRedirect(clientRedirect, body.data.redirectTo);

  return {
    ok: true,
    message: "Signed in.",
    requestId,
    ...(destination ? { destination } : {}),
  };
}
