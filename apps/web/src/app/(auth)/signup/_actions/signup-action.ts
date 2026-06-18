"use server";

import { redirect } from "next/navigation";
import { GENERIC_SIGNUP_ERROR_MESSAGE } from "@atlas/domain-identity";
import { readFormString } from "../../../../lib/server/form";
import { orchestratePublicSignup } from "../../../../lib/server/public-auth-orchestrator";

export type SignupActionState = {
  ok: boolean;
  message: string;
  requestId: string;
  verificationRequired?: boolean;
};

export async function signupAction(
  _prev: SignupActionState | null,
  formData: FormData,
): Promise<SignupActionState> {
  const requestId = crypto.randomUUID();
  const email = readFormString(formData.get("email")).trim().toLowerCase();
  const password = readFormString(formData.get("password"));
  const displayName = readFormString(formData.get("displayName")).trim();
  const inviteToken = readFormString(formData.get("inviteToken")).trim();

  if (!email || !password || displayName.length < 2) {
    return {
      ok: false,
      message: "Check your details and try again.",
      requestId,
    };
  }

  try {
    const body = await orchestratePublicSignup({
      email,
      password,
      displayName,
      ...(inviteToken ? { inviteToken } : {}),
    });

    if (body.data.status === "EMAIL_VERIFICATION_REQUIRED") {
      return {
        ok: true,
        message: "Check your email to verify your account before signing in.",
        requestId,
        verificationRequired: true,
      };
    }

    if (inviteToken) {
      redirect(`/invite/accept?token=${encodeURIComponent(inviteToken)}`);
    }

    if (body.data.redirectTo) {
      redirect(body.data.redirectTo);
    }

    redirect("/login");
  } catch {
    return {
      ok: false,
      message: GENERIC_SIGNUP_ERROR_MESSAGE,
      requestId,
    };
  }
}
