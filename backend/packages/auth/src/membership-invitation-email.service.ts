import { AtlasHttpError } from "@atlas/core/http/errors";
import {
  createSupabaseAdminServerClient,
  createSupabasePublicServerClient,
} from "./supabase-server";

function isExistingSupabaseUserError(error: {
  message: string;
  status?: number | undefined;
}): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("user already") ||
    error.status === 422
  );
}

function invitationEmailFailed(): never {
  throw new AtlasHttpError({
    code: "INTERNAL_ERROR",
    status: 502,
    message: "Unable to send the invitation email. Please try again.",
  });
}

/**
 * Delivers a tenant membership invitation through Supabase Auth (project SMTP).
 * New recipients get Supabase's invite email; existing auth users get a magic link
 * with the same redirect so they land on `/invite/accept?token=…` after signing in.
 */
export async function sendTenantInvitationEmail(args: {
  email: string;
  inviteUrl: string;
}): Promise<void> {
  const admin = createSupabaseAdminServerClient();

  const invite = await admin.auth.admin.inviteUserByEmail(args.email, {
    redirectTo: args.inviteUrl,
  });

  if (!invite.error) {
    return;
  }

  if (!isExistingSupabaseUserError(invite.error)) {
    invitationEmailFailed();
  }

  const supabase = createSupabasePublicServerClient();
  const otp = await supabase.auth.signInWithOtp({
    email: args.email,
    options: { emailRedirectTo: args.inviteUrl },
  });

  if (otp.error) {
    invitationEmailFailed();
  }
}
