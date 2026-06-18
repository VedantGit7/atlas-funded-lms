"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabasePublicServerClient } from "@atlas/auth/supabase-server";
import { GENERIC_PASSWORD_RESET_MESSAGE } from "@atlas/domain-identity";
import { readFormString } from "../../../../lib/server/form";

export type ResetPasswordActionState = {
  ok: boolean;
  message: string;
  requestId: string;
};

async function getRequestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function requestPasswordResetAction(
  _prev: ResetPasswordActionState | null,
  formData: FormData,
): Promise<ResetPasswordActionState> {
  const requestId = crypto.randomUUID();
  const email = readFormString(formData.get("email")).trim().toLowerCase();

  if (!email) {
    return { ok: false, message: "Enter a valid email address.", requestId };
  }

  try {
    const supabase = createSupabasePublicServerClient();
    const origin = await getRequestOrigin();

    await supabase.auth.resetPasswordForEmail(email, {
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
  const password = readFormString(formData.get("password"));
  const accessToken = readFormString(formData.get("accessToken"));
  const refreshToken = readFormString(formData.get("refreshToken"));

  if (password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters.", requestId };
  }

  if (!accessToken) {
    return { ok: false, message: "Reset link is invalid or expired.", requestId };
  }

  try {
    const supabase = createSupabasePublicServerClient();
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const { error } = await supabase.auth.updateUser({ password });

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
