import { createClient } from "@supabase/supabase-js";
import { getAuthEnv } from "./env";
import { invalidCredentials } from "./auth-errors";
import { upsertAuthPrincipal } from "./auth-principal.repository";
import { toSessionSafeIdentity } from "./auth-principal.service";

type QueryableDb = Parameters<typeof upsertAuthPrincipal>[0]["db"];

export type OAuthProvider = "google" | "apple";

/**
 * Supabase OAuth uses the PKCE flow: a `code_verifier` is generated when the
 * authorization URL is built and must be replayed when exchanging the returned
 * `code` for a session. The two halves run in separate stateless requests, so
 * we capture the verifier from a throwaway in-memory storage and persist it in
 * an httpOnly cookie between the two hops (handled by the route layer).
 */
const OAUTH_STORAGE_KEY = "sb-oauth";
const CODE_VERIFIER_KEY = `${OAUTH_STORAGE_KEY}-code-verifier`;

type MemoryStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function createMemoryStorage(seed?: Record<string, string>): {
  storage: MemoryStorage;
  map: Map<string, string>;
} {
  const map = new Map<string, string>(Object.entries(seed ?? {}));
  const storage: MemoryStorage = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
  return { storage, map };
}

function createOAuthClient(storage: MemoryStorage) {
  const env = getAuthEnv();

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "pkce",
      storage,
      storageKey: OAUTH_STORAGE_KEY,
    },
  });
}

type SignInWithOAuthResult = {
  data: { url?: string | null } | null;
  error: { message: string } | null;
};

/**
 * Builds the provider authorization URL and returns it along with the PKCE
 * verifier the caller must store until the callback runs. The browser redirect
 * itself is performed by the route layer (skipBrowserRedirect).
 */
export async function startOAuthSignIn(args: {
  provider: OAuthProvider;
  redirectTo: string;
}): Promise<{ url: string; codeVerifier: string }> {
  const { storage, map } = createMemoryStorage();
  const supabase = createOAuthClient(storage);

  const result = (await supabase.auth.signInWithOAuth({
    provider: args.provider,
    options: {
      redirectTo: args.redirectTo,
      skipBrowserRedirect: true,
    },
  })) as SignInWithOAuthResult;

  const url = result.data?.url;
  const codeVerifier = map.get(CODE_VERIFIER_KEY);

  if (result.error || !url || !codeVerifier) {
    throw invalidCredentials();
  }

  return { url, codeVerifier };
}

type ExchangeCodeResult = {
  data: {
    user: {
      id: string;
      email: string;
      email_confirmed_at?: string | null;
      factors?: unknown;
    } | null;
    session: { access_token: string; refresh_token: string; expires_in: number } | null;
  };
  error: { message: string } | null;
};

/**
 * Exchanges the OAuth `code` for a Supabase session using the stored PKCE
 * verifier, then mirrors the principal into the local identity store exactly
 * like password sign-in does.
 */
export async function completeOAuthSignIn(args: {
  db: QueryableDb;
  code: string;
  codeVerifier: string;
}) {
  const { storage } = createMemoryStorage({ [CODE_VERIFIER_KEY]: args.codeVerifier });
  const supabase = createOAuthClient(storage);

  const result = (await supabase.auth.exchangeCodeForSession(args.code)) as ExchangeCodeResult;

  const user = result.data.user;
  const session = result.data.session;

  if (result.error || !user?.id || !user.email || !session) {
    throw invalidCredentials();
  }

  const principal = await upsertAuthPrincipal({
    db: args.db,
    supabaseUserId: user.id,
    email: user.email,
    emailConfirmed: Boolean(user.email_confirmed_at),
    mfaEnabled: Array.isArray(user.factors) && user.factors.length > 0,
    markLogin: true,
  });

  return {
    status: "signed_in" as const,
    identity: toSessionSafeIdentity(principal),
    email: user.email,
    session: {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
    },
  };
}
