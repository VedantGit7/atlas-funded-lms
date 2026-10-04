import { AtlasHttpError } from "@atlas/core/http/errors";
import { authRequired, passwordPolicyRejection } from "./auth-errors";
import { requireSupabaseUserClient } from "./supabase-user-client";

function mapAuthError(): never {
  throw new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "Unable to complete this security action. Please try again.",
  });
}

export async function changePassword(args: { currentPassword: string; newPassword: string }) {
  const { supabase, email } = await requireSupabaseUserClient();

  const signIn = await supabase.auth.signInWithPassword({
    email,
    password: args.currentPassword,
  });

  if (signIn.error) {
    mapAuthError();
  }

  const { error } = await supabase.auth.updateUser({ password: args.newPassword });
  if (error) {
    const rejection = passwordPolicyRejection(error);
    if (rejection) throw rejection;
    mapAuthError();
  }

  return { ok: true as const, email };
}

export async function changeEmail(args: { newEmail: string; emailRedirectTo?: string }) {
  const { supabase } = await requireSupabaseUserClient();

  const { error } = await supabase.auth.updateUser(
    { email: args.newEmail },
    args.emailRedirectTo ? { emailRedirectTo: args.emailRedirectTo } : undefined,
  );

  if (error) {
    mapAuthError();
  }

  return { ok: true as const, email: args.newEmail };
}

export async function startPhoneChange(args: { phone: string }) {
  const { supabase } = await requireSupabaseUserClient();

  const { error } = await supabase.auth.updateUser({ phone: args.phone });
  if (error) {
    mapAuthError();
  }

  return { ok: true as const };
}

export async function verifyPhoneChange(args: { phone: string; token: string }) {
  const { supabase } = await requireSupabaseUserClient();

  const { error } = await supabase.auth.verifyOtp({
    phone: args.phone,
    token: args.token,
    type: "phone_change",
  });

  if (error) {
    mapAuthError();
  }

  return { ok: true as const };
}

export async function listMfaFactors() {
  const { supabase } = await requireSupabaseUserClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    mapAuthError();
  }

  const factors = [...data.totp, ...data.phone].map((factor) => ({
    id: factor.id,
    factorType: factor.factor_type,
    status: factor.status,
    friendlyName: factor.friendly_name ?? null,
  }));

  return { factors };
}

export async function enrollMfaTotp() {
  const { supabase } = await requireSupabaseUserClient();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Authenticator app",
  });

  if (error) {
    mapAuthError();
  }

  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

/** A session that completed MFA (aal2), to be set as the caller's cookies. */
export type MfaVerifiedSession = { accessToken: string; refreshToken: string; expiresIn: number };

async function verifiedSession(
  supabase: Awaited<ReturnType<typeof requireSupabaseUserClient>>["supabase"],
): Promise<MfaVerifiedSession> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) mapAuthError();
  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in,
  };
}

function invalidMfaCode(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "That code didn't work. Check your authenticator app and try again.",
  });
}

/**
 * Verifies a newly enrolled factor. Verification also completes MFA for this
 * session, so the returned aal2 session must replace the caller's cookies:
 * otherwise someone who enrolls in order to reach a step-up action still holds
 * an aal1 session and is challenged again (audit H4).
 */
export async function verifyMfaEnrollment(args: { factorId: string; code: string }) {
  const { supabase } = await requireSupabaseUserClient();

  const challenge = await supabase.auth.mfa.challenge({ factorId: args.factorId });
  if (challenge.error) {
    mapAuthError();
  }

  const verify = await supabase.auth.mfa.verify({
    factorId: args.factorId,
    challengeId: challenge.data.id,
    code: args.code,
  });

  if (verify.error) {
    throw invalidMfaCode();
  }

  return { ok: true as const, session: await verifiedSession(supabase) };
}

/**
 * Step-up: completes MFA for the current session with an already-verified
 * factor, returning the aal2 session (audit H4). Routes that declare
 * `mfa: "required"` accept the session from then on.
 */
export async function stepUpMfa(args: { code: string; factorId?: string | undefined }) {
  const { supabase } = await requireSupabaseUserClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    mapAuthError();
  }

  // `totp` lists verified TOTP factors only; unverified enrollments cannot step up.
  const factor = args.factorId
    ? data.totp.find((candidate) => candidate.id === args.factorId)
    : data.totp[0];
  if (!factor) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "Set up an authenticator app before continuing.",
    });
  }

  const verify = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: args.code,
  });
  if (verify.error) {
    throw invalidMfaCode();
  }

  return { session: await verifiedSession(supabase) };
}

export async function unenrollMfaFactor(args: { factorId: string }) {
  const { supabase } = await requireSupabaseUserClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId: args.factorId });
  if (error) {
    mapAuthError();
  }
  return { ok: true as const };
}

export async function signOutOtherSessions() {
  const { supabase } = await requireSupabaseUserClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) {
    mapAuthError();
  }
  return { ok: true as const };
}

export async function listLinkedIdentities() {
  const { supabase } = await requireSupabaseUserClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw authRequired();
  }

  const identities = (user.identities ?? []).map((identity) => ({
    id: identity.id,
    provider: identity.provider,
    email: (identity.identity_data?.["email"] as string | undefined) ?? null,
    createdAt: identity.created_at ?? null,
  }));

  return { identities };
}

export async function startLinkIdentity(args: {
  provider: "google" | "apple";
  redirectTo: string;
}) {
  const { supabase } = await requireSupabaseUserClient();

  const { data, error } = await supabase.auth.linkIdentity({
    provider: args.provider,
    options: { redirectTo: args.redirectTo },
  });

  if (error || !data.url) {
    mapAuthError();
  }

  return { url: data.url };
}

export async function unlinkIdentity(args: { identityId: string }) {
  const { supabase } = await requireSupabaseUserClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw authRequired();
  }

  const identity = (user.identities ?? []).find((item) => item.id === args.identityId);
  if (!identity) {
    mapAuthError();
  }

  const { error } = await supabase.auth.unlinkIdentity(identity);

  if (error) {
    mapAuthError();
  }

  return { ok: true as const };
}

export async function sendMagicLink(args: { email: string; emailRedirectTo?: string }) {
  const supabase = (await import("./supabase-server")).createSupabasePublicServerClient();

  const { error } = await supabase.auth.signInWithOtp(
    args.emailRedirectTo
      ? { email: args.email, options: { emailRedirectTo: args.emailRedirectTo } }
      : { email: args.email },
  );

  if (error) {
    mapAuthError();
  }

  return { ok: true as const };
}
