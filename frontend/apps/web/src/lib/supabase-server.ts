import { createClient } from "@supabase/supabase-js";

export function createSupabasePublicServerClient() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

  if (!url || !anonKey) {
    throw new Error("SUPABASE_PUBLIC_CONFIG_MISSING");
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
