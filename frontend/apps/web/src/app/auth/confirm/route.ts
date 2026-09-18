import { NextResponse, type NextRequest } from "next/server";
import { confirmEmailViaInternalApi } from "../../../lib/server/public-auth-fetch";
import { resolveRequestOrigin } from "../../../lib/server/resolve-request-origin";

// Supabase email-verification links point here with a single-use `token_hash`
// (token-hash / PKCE SSR flow). We verify it server-side via the internal API,
// forward the issued session cookies onto the redirect, and send the user on.
// No session tokens in the URL and no client-side hash parsing that can hang.
//
// Email template (Supabase dashboard → Auth → Email Templates → Confirm signup):
//   <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup">Confirm</a>
// where {{ .RedirectTo }} is the per-tenant `emailRedirectTo` we pass at signup
// (https://<tenant>/auth/confirm), which must be in Supabase's Redirect URLs.

export const dynamic = "force-dynamic";

/**
 * Only allow same-origin absolute paths as the post-verification destination,
 * and never bounce back into the auth/confirm namespace (which would loop).
 */
function sanitizeNext(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  if (value.startsWith("/auth/")) {
    return null;
  }
  return value;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const origin = resolveRequestOrigin(request);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = sanitizeNext(url.searchParams.get("next") ?? url.searchParams.get("redirect_to"));

  const toVerifyEmail = (status: string) =>
    NextResponse.redirect(new URL(`/verify-email?status=${status}`, origin));

  if (!tokenHash || !type) {
    return toVerifyEmail("invalid");
  }

  const result = await confirmEmailViaInternalApi({ tokenHash, type });

  if (!result.ok) {
    // The email was likely already verified by a prior click, or the link
    // expired / was consumed. Send the user somewhere recoverable.
    return toVerifyEmail("expired");
  }

  const authenticated = result.status === "AUTHENTICATED" || result.status === "INVITED_MEMBERSHIP";

  let destination: URL;
  if (authenticated) {
    // Verified + signed in → show the branded "You're all set" success screen,
    // which then auto-redirects to the role home (or an explicit, safe `next`).
    const dest = next ?? result.redirectTo ?? "/";
    destination = new URL("/verify-email", origin);
    destination.searchParams.set("status", "success");
    destination.searchParams.set("next", dest);
  } else {
    // Verified but not auto-signed-in (e.g. MFA / no active membership) → sign in
    // with a success banner.
    destination = new URL("/login?verified=1", origin);
  }

  const redirect = NextResponse.redirect(destination);
  for (const cookie of result.setCookies) {
    redirect.headers.append("set-cookie", cookie);
  }
  return redirect;
}
