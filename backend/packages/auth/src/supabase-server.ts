import { createClient } from "@supabase/supabase-js";
import { getAuthEnv } from "./env";
import { sessionVerificationFetch } from "./session-verification-fetch";

export function createSupabasePublicServerClient() {
  const env = getAuthEnv();

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createSupabaseAdminServerClient() {
  const env = getAuthEnv();

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/** A fresh client and response holder for one access-token verification only. */
export function createSupabaseSessionVerificationClient() {
  const env = getAuthEnv();
  const userEndpoint = `${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`;
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: sessionVerificationFetch(userEndpoint, fetch) },
  });
}
