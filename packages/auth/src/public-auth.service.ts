import type { PublicLoginInput, PublicSignupInput } from "./schemas";
import { createSupabasePublicServerClient } from "./supabase-server";
import { invalidCredentials } from "./auth-errors";
import { upsertAuthPrincipal } from "./auth-principal.repository";
import { toSessionSafeIdentity } from "./auth-principal.service";

type QueryableDb = Parameters<typeof upsertAuthPrincipal>[0]["db"];

type SupabasePasswordSignInResult = {
  data: {
    user: { id: string; email: string; factors?: unknown } | null;
    session: { access_token: string; refresh_token: string; expires_in: number } | null;
  };
  error: { message: string } | null;
};

function assertPasswordSignInResult(result: SupabasePasswordSignInResult): asserts result is {
  data: {
    user: { id: string; email: string; factors?: unknown };
    session: { access_token: string; refresh_token: string; expires_in: number };
  };
  error: null;
} {
  if (result.error || !result.data.user?.id || !result.data.user.email || !result.data.session) {
    throw invalidCredentials();
  }
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
    session: {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
    },
  };
}

export async function signupWithPassword(args: { db: QueryableDb; input: PublicSignupInput }) {
  const supabase = createSupabasePublicServerClient();

  const { data, error } = await supabase.auth.signUp({
    email: args.input.email,
    password: args.input.password,
  });

  if (error) {
    throw invalidCredentials();
  }

  if (!data.user || !data.user.id || !data.user.email) {
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
