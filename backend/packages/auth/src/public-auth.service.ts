import type { EmailOtpType } from "@supabase/supabase-js";
import type { PublicLoginInput, PublicSignupInput } from "./schemas";
import { createSupabasePublicServerClient } from "./supabase-server";
import { invalidCredentials, authEmailRateLimited } from "./auth-errors";
import { upsertAuthPrincipal } from "./auth-principal.repository";
import { toSessionSafeIdentity } from "./auth-principal.service";

type QueryableDb = Parameters<typeof upsertAuthPrincipal>[0]["db"];

type SupabaseUserMetadata = Record<string, unknown> | null | undefined;

type SupabasePasswordSignInResult = {
  data: {
    user: {
      id: string;
      email: string;
      factors?: unknown;
      user_metadata?: SupabaseUserMetadata;
    } | null;
    session: { access_token: string; refresh_token: string; expires_in: number } | null;
  };
  error: { message: string } | null;
};

function assertPasswordSignInResult(result: SupabasePasswordSignInResult): asserts result is {
  data: {
    user: { id: string; email: string; factors?: unknown; user_metadata?: SupabaseUserMetadata };
    session: { access_token: string; refresh_token: string; expires_in: number };
  };
  error: null;
} {
  if (result.error || !result.data.user?.id || !result.data.user.email || !result.data.session) {
    throw invalidCredentials();
  }
}

function readDisplayNameFromMetadata(metadata: SupabaseUserMetadata): string | null {
  const value = metadata?.["display_name"];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function loginWithPassword(args: { db: QueryableDb; input: PublicLoginInput }) {
  const supabase = createSupabasePublicServerClient();

  const result = (await supabase.auth.signInWithPassword({
    email: args.input.email,
    password: args.input.password,
  })) as SupabasePasswordSignInResult;

  assertPasswordSignInResult(result);

  const { user, session } = result.data;

  const principal = await upsertAuthPrincipal({
    db: args.db,
    supabaseUserId: user.id,
    email: user.email,
    mfaEnabled: Array.isArray(user.factors) && user.factors.length > 0,
    markLogin: true,
  });

  return {
    status: "signed_in" as const,
    identity: toSessionSafeIdentity(principal),
    displayName: readDisplayNameFromMetadata(user.user_metadata),
    session: {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
    },
  };
}

function throwMappedSignupError(error: {
  message?: string | undefined;
  status?: number | undefined;
  code?: string | undefined;
}): never {
  const message = error.message?.toLowerCase() ?? "";
  const code = error.code?.toLowerCase() ?? "";

  if (error.status === 429 || code.includes("rate_limit") || message.includes("rate limit")) {
    throw authEmailRateLimited();
  }

  throw invalidCredentials();
}

export async function signupWithPassword(args: { db: QueryableDb; input: PublicSignupInput }) {
  const supabase = createSupabasePublicServerClient();

  const displayName = args.input.displayName?.trim();
  const emailRedirectTo = args.input.emailRedirectTo?.trim();

  const options: { data?: { display_name: string }; emailRedirectTo?: string } = {};
  if (displayName) {
    options.data = { display_name: displayName };
  }
  if (emailRedirectTo) {
    // Tenant-aware verification link: Supabase sends the confirmation email back
    // to this URL instead of the project-wide default Site URL. The URL must be
    // allow-listed in the Supabase Auth "Redirect URLs" configuration.
    options.emailRedirectTo = emailRedirectTo;
  }

  const { data, error } = await supabase.auth.signUp({
    email: args.input.email,
    password: args.input.password,
    ...(Object.keys(options).length > 0 ? { options } : {}),
  });

  if (error) {
    throwMappedSignupError(error);
  }

  if (!data.user || !data.user.id || !data.user.email) {
    return {
      status: "verification_required" as const,
      identity: undefined,
      session: undefined,
    };
  }

  // Anti-enumeration: when the email is already registered, Supabase returns an
  // obfuscated user with an empty `identities` array and sends NO email (a
  // confirmation was already delivered for the real account). Do NOT mirror this
  // fabricated user into auth_principals — its id is a throwaway that would
  // overwrite the genuine principal's supabase_user_id. Surface the same
  // verification_required state so the response can't be used to probe accounts.
  const identities = (data.user as { identities?: unknown[] | null }).identities;
  if (Array.isArray(identities) && identities.length === 0) {
    return {
      status: "verification_required" as const,
      identity: undefined,
      session: undefined,
    };
  }

  const principal = await upsertAuthPrincipal({
    db: args.db,
    supabaseUserId: data.user.id,
    email: data.user.email,
    mfaEnabled: Array.isArray(data.user.factors) && data.user.factors.length > 0,
    markLogin: Boolean(data.session),
  });

  return {
    status: data.session ? ("signed_in" as const) : ("verification_required" as const),
    identity: toSessionSafeIdentity(principal),
    session: data.session
      ? {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresIn: data.session.expires_in,
        }
      : undefined,
  };
}

/**
 * Establishes a server-side session from the single-use `token_hash` delivered
 * in an email-verification link (Supabase PKCE/SSR flow). `verifyOtp` POSTs to
 * Supabase Auth, so the verified session is returned in the response body — it
 * never travels through the URL. We mirror the principal into the local identity
 * store and return the canonical session for cookie issuance.
 */
export async function establishSessionFromTokenHash(args: {
  db: QueryableDb;
  tokenHash: string;
  type: EmailOtpType;
}) {
  const supabase = createSupabasePublicServerClient();

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: args.tokenHash,
    type: args.type,
  });

  const user = data.user;
  const session = data.session;

  if (error || !user?.id || !user.email || !session) {
    throw invalidCredentials();
  }

  const principal = await upsertAuthPrincipal({
    db: args.db,
    supabaseUserId: user.id,
    email: user.email,
    mfaEnabled: Array.isArray(user.factors) && user.factors.length > 0,
    markLogin: true,
  });

  return {
    status: "signed_in" as const,
    identity: toSessionSafeIdentity(principal),
    displayName: readDisplayNameFromMetadata(user.user_metadata),
    session: {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
    },
  };
}

/**
 * Re-sends the signup verification email. Anti-enumeration: the outcome is
 * uniform regardless of whether the address exists or is already verified, so
 * the response can't be used to probe accounts. Supabase enforces its own
 * per-email send cooldown; the UI adds a client-side cooldown on top.
 */
/**
 * Finalizes an invited account from the session carried in the invitation email
 * link (Supabase implicit flow). We rehydrate the invited user's session, set
 * their chosen password, then return the canonical (post-update) session so the
 * caller can issue Atlas cookies — leaving the invitee fully signed in as their
 * own account, regardless of who was signed in on the device before.
 */
export async function setPasswordFromInvitationSession(args: {
  db: QueryableDb;
  accessToken: string;
  refreshToken: string;
  password: string;
}) {
  const supabase = createSupabasePublicServerClient();

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: args.accessToken,
    refresh_token: args.refreshToken,
  });

  if (sessionError) {
    throw invalidCredentials();
  }

  const { data: updated, error: updateError } = await supabase.auth.updateUser({
    password: args.password,
  });

  if (updateError) {
    throw invalidCredentials();
  }

  const updatedUser = updated.user;

  if (!updatedUser.email) {
    throw invalidCredentials();
  }

  const { data: sessionData, error: getSessionError } = await supabase.auth.getSession();
  const session = sessionData.session;

  if (getSessionError || !session) {
    throw invalidCredentials();
  }

  const principal = await upsertAuthPrincipal({
    db: args.db,
    supabaseUserId: updatedUser.id,
    email: updatedUser.email,
    mfaEnabled: Array.isArray(updatedUser.factors) && updatedUser.factors.length > 0,
    markLogin: true,
  });

  return {
    principal: {
      id: principal.id,
      emailNormalized: principal.emailNormalized,
      mfaEnabled: principal.mfaEnabled,
    },
    session: {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
    },
  };
}

export async function refreshSessionFromRefreshToken(args: { refreshToken: string }) {
  const supabase = createSupabasePublicServerClient();

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: args.refreshToken,
  });

  const session = data.session;

  if (error || !session?.access_token || !session.refresh_token) {
    throw invalidCredentials();
  }

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in,
  };
}

/**
 * Validates an existing Supabase session from access/refresh tokens and mirrors
 * the principal into the local identity store.
 */
export async function establishSessionFromTokens(args: {
  db: QueryableDb;
  accessToken: string;
  refreshToken: string;
}) {
  const supabase = createSupabasePublicServerClient();

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: args.accessToken,
    refresh_token: args.refreshToken,
  });

  if (sessionError) {
    throw invalidCredentials();
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const {
    data: { session },
    error: verifiedSessionError,
  } = await supabase.auth.getSession();

  if (userError || verifiedSessionError || !user?.id || !user.email || !session) {
    throw invalidCredentials();
  }

  const principal = await upsertAuthPrincipal({
    db: args.db,
    supabaseUserId: user.id,
    email: user.email,
    mfaEnabled: Array.isArray(user.factors) && user.factors.length > 0,
    markLogin: true,
  });

  return {
    status: "signed_in" as const,
    identity: toSessionSafeIdentity(principal),
    displayName: readDisplayNameFromMetadata(user.user_metadata),
    session: {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
    },
  };
}

export async function resendSignupVerification(args: {
  email: string;
  emailRedirectTo?: string;
}): Promise<{ ok: true }> {
  const supabase = createSupabasePublicServerClient();

  await supabase.auth
    .resend({
      type: "signup",
      email: args.email,
      ...(args.emailRedirectTo ? { options: { emailRedirectTo: args.emailRedirectTo } } : {}),
    })
    .catch(() => undefined);

  return { ok: true as const };
}

export async function verifyMfaChallenge(args: {
  accessToken: string;
  refreshToken: string;
  code: string;
}) {
  const supabase = createSupabasePublicServerClient();

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: args.accessToken,
    refresh_token: args.refreshToken,
  });

  if (sessionError) {
    throw invalidCredentials();
  }

  const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) {
    throw invalidCredentials();
  }

  const totpFactor = factorsData.totp[0];
  if (!totpFactor) {
    throw invalidCredentials();
  }

  const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
    factorId: totpFactor.id,
    code: args.code,
  });

  if (verifyError) {
    throw invalidCredentials();
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const {
    data: { session },
    error: verifiedSessionError,
  } = await supabase.auth.getSession();

  if (userError || verifiedSessionError || !user?.email || !session) {
    throw invalidCredentials();
  }

  return {
    user: { email: user.email },
    session: {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
    },
  };
}
