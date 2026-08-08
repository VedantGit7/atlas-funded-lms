"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabasePublicServerClient } from "@atlas/auth/supabase-server";
import {
  PublicPasswordResetCompleteSchema,
  PublicPasswordResetRequestSchema,
} from "@atlas/contracts/domain-identity/schemas/public-auth";
import { GENERIC_PASSWORD_RESET_MESSAGE } from "../../../../lib/auth-messages";
import { readFormString } from "../../../../lib/server/form";
import { resolveRequestOriginFromHeaders } from "../../../../lib/server/resolve-request-origin";

export type ResetPasswordActionState = {
  ok: boolean;
  message: string;
  requestId: string;
};

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
  });

  if (!parsed.success) {
    return { ok: false, message: "Password must be at least 8 characters.", requestId };
  }

  if (!parsed.data.accessToken) {
    return { ok: false, message: "Reset link is invalid or expired.", requestId };
  }

  try {
    const supabase = createSupabasePublicServerClient();
    await supabase.auth.setSession({
      access_token: parsed.data.accessToken,
      refresh_token: parsed.data.refreshToken ?? "",
    });

    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

    if (error) {
      return { ok: false, message: "Unable to reset password. Request a new link.", requestId };
    }

    redirect("/login");
  } catch {
    return { ok: false, message: "Unable to reset password. Request a new link.", requestId };
  }

  return { ok: true, message: GENERIC_PASSWORD_RESET_MESSAGE, requestId };
}

export async function clearRecoverySessionAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("atlas_access_token");
  cookieStore.delete("atlas_refresh_token");
}
