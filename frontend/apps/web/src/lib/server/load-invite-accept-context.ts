import { buildApiProxyHeaders } from "@atlas/core/http/api-proxy";
import { resolveTenantHostForInternalApi } from "./resolve-tenant-host";
import { resolveClientIpForInternalApi } from "./resolve-client-ip";
import { resolveCookieHeaderForInternalApi } from "./resolve-request-cookies";

const API_INTERNAL_URL = process.env["API_INTERNAL_URL"] ?? "http://127.0.0.1:3001";

export type InviteAcceptContext = {
  isAuthenticated: boolean;
  signedInEmail: string | null;
  invitedEmail: string | null;
  inviteValid: boolean;
  /**
   * Better Auth (launch plan task 3.6): "none" when the invited address can't
   * sign in yet, so the page sets a password; "exists" when it should sign in.
   * Null with Supabase, whose invitation link carries its own session.
   */
  inviteAccount: "none" | "exists" | null;
};

type InvitePreview = Omit<InviteAcceptContext, "isAuthenticated">;

const INVALID: InvitePreview = {
  invitedEmail: null,
  inviteValid: false,
  signedInEmail: null,
  inviteAccount: null,
};

/**
 * The invitation, and who is signed in on this browser, from the API. It reads
 * the session itself, so this page works with either login system and never
 * asks one directly.
 */
async function readInvitePreview(token: string): Promise<InvitePreview> {
  const forwardedHost = await resolveTenantHostForInternalApi();
  const cookieHeader = await resolveCookieHeaderForInternalApi();
  const url = new URL("/api/v1/public/invitations/preview", API_INTERNAL_URL);
  url.searchParams.set("token", token);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: buildApiProxyHeaders(
        forwardedHost,
        cookieHeader ? { cookie: cookieHeader } : undefined,
        process.env,
        await resolveClientIpForInternalApi(),
      ),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      return INVALID;
    }

    const payload = (await response.json()) as {
      data?: {
        invitedEmail?: string;
        signedInEmail?: string | null;
        account?: "none" | "exists";
      };
    };

    return {
      invitedEmail: payload.data?.invitedEmail?.trim().toLowerCase() ?? null,
      inviteValid: true,
      signedInEmail: payload.data?.signedInEmail?.trim().toLowerCase() ?? null,
      inviteAccount: payload.data?.account ?? null,
    };
  } catch {
    return INVALID;
  }
}

export async function loadInviteAcceptContext(
  token: string | undefined,
): Promise<InviteAcceptContext> {
  if (!token) {
    return { isAuthenticated: false, ...INVALID };
  }

  const preview = await readInvitePreview(token);
  return { isAuthenticated: Boolean(preview.signedInEmail), ...preview };
}
