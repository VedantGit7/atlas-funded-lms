"use server";

import { redirect } from "next/navigation";
import { GENERIC_LOGIN_ERROR_MESSAGE } from "@atlas/domain-identity";
import { readFormString } from "../../../../lib/server/form";
import { orchestratePublicLogin } from "../../../../lib/server/public-auth-orchestrator";

export type LoginActionState = {
  ok: boolean;
  message: string;
  requestId: string;
  mfaRequired?: boolean;
};

export async function loginAction(
  _prev: LoginActionState | null,
  formData: FormData,
): Promise<LoginActionState> {
  const requestId = crypto.randomUUID();
  const email = readFormString(formData.get("email")).trim().toLowerCase();
  const password = readFormString(formData.get("password"));

  if (!email || !password) {
    return { ok: false, message: GENERIC_LOGIN_ERROR_MESSAGE, requestId };
  }

  try {
    const body = await orchestratePublicLogin({ email, password });

    if (body.data.status === "MFA_REQUIRED") {
      return {
        ok: false,
        message: "Multi-factor authentication is required to continue.",
        requestId,
        mfaRequired: true,
      };
    }

    if (body.data.status === "INVITED_MEMBERSHIP") {
      redirect("/invite/accept");
    }

    if (body.data.status === "NO_ACTIVE_MEMBERSHIP") {
      return {
        ok: false,
        message: "You do not have active access to this academy.",
        requestId,
      };
    }

    if (body.data.redirectTo) {
      redirect(body.data.redirectTo);
    }

    return { ok: true, message: "Signed in.", requestId };
  } catch {
    return { ok: false, message: GENERIC_LOGIN_ERROR_MESSAGE, requestId };
  }
}
