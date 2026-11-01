import { NextResponse, type NextRequest } from "next/server";
import { handleOAuthCallback } from "../../oauth/oauth-callback";
import { resolveRequestOrigin } from "../../oauth/oauth-shared";

/**
 * Better Auth's Google redirect address, `https://<academy>/auth/callback/google`,
 * as registered on the Google clients (decision doc, "Google sign-in").
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (provider !== "google") {
    return NextResponse.redirect(`${resolveRequestOrigin(req)}/login?error=oauth`);
  }
  return handleOAuthCallback(req);
}
