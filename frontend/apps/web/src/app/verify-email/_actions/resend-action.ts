"use server";

import { z } from "zod";
import { serverPublicApi } from "../../../lib/server/public-auth-fetch";
import { resolveTenantEmailRedirect } from "../../../lib/server/tenant-email-redirect";

const EmailSchema = z
  .string()
  .email()
  .transform((value) => value.trim().toLowerCase());

export type ResendActionState = {
  ok: boolean;
  message: string;
};

/**
 * Requests a fresh signup verification email. The backend response is uniform
 * (anti-enumeration), so we always report the same neutral success; any
 * backend/rate-limit error is swallowed. A client-side cooldown throttles the UI
 * on top of the server-side public-auth rate limit + Supabase's per-email cap.
 */
export async function resendVerificationAction(
  _prev: ResendActionState | null,
  formData: FormData,
): Promise<ResendActionState> {
  const parsed = EmailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const emailRedirectTo = await resolveTenantEmailRedirect();

  try {
    await serverPublicApi.resend({
      email: parsed.data,
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
    });
  } catch {
    // Intentionally ignored: never reveal whether the address exists, is already
    // verified, or was rate-limited.
  }

  return {
    ok: true,
    message: "If your email needs verification, we've sent a new link. Check your inbox.",
  };
}
