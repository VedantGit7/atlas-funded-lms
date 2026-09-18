"use server";

import { PublicMfaVerifyRequestSchema } from "@atlas/contracts/domain-identity/schemas/public-auth";
import {
  resolvePostAuthRedirect,
  resolveSafeRedirectPath,
} from "../../../../lib/auth/safe-redirect";
import { readFormString } from "../../../../lib/server/form";
import { serverPublicApi } from "../../../../lib/server/public-auth-fetch";

export type VerifyMfaActionState = {
  ok: boolean;
  message: string;
  requestId: string;
  destination?: string;
};

export async function verifyMfaAction(
  _prev: VerifyMfaActionState | null,
  formData: FormData,
): Promise<VerifyMfaActionState> {
  const requestId = crypto.randomUUID();
  const clientRedirect = resolveSafeRedirectPath(readFormString(formData.get("redirectTo")));
  const parsed = PublicMfaVerifyRequestSchema.safeParse({
    code: readFormString(formData.get("code")),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Enter the 6-digit code from your authenticator app.",
      requestId,
    };
  }

  let body: Awaited<ReturnType<typeof serverPublicApi.verifyMfa>>;

  try {
    body = await serverPublicApi.verifyMfa(parsed.data);
  } catch {
    return { ok: false, message: "Invalid or expired code. Try again.", requestId };
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
    message: "Verified.",
    requestId,
    ...(destination ? { destination } : {}),
  };
}
