import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ATLAS_ACCESS_TOKEN_COOKIE, ATLAS_REFRESH_TOKEN_COOKIE } from "./cookie-names";
import { authRequired } from "./auth-errors";
import { createSupabasePublicServerClient } from "./supabase-server";

export async function extractSessionTokensFromCookies(): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ATLAS_ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(ATLAS_REFRESH_TOKEN_COOKIE)?.value;

  if (!accessToken || !refreshToken) {
    throw authRequired();
  }

  return { accessToken, refreshToken };
}

export async function createSupabaseUserClient(): Promise<SupabaseClient> {
  const { accessToken, refreshToken } = await extractSessionTokensFromCookies();
  const supabase = createSupabasePublicServerClient();

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    throw authRequired();
  }

  return supabase;
}

export async function requireSupabaseUserClient(): Promise<{
  supabase: SupabaseClient;
  email: string;
  userId: string;
}> {
  const supabase = await createSupabaseUserClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id || !user.email) {
    throw authRequired();
  }

  return { supabase, email: user.email, userId: user.id };
}
