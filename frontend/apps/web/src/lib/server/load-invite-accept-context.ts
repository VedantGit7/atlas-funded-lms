import { headers } from "next/headers";
import { createSupabaseAdminServerClient } from "@atlas/auth/supabase-server";
import { extractAccessToken } from "@atlas/auth/session";
import { ATLAS_INTERNAL_TENANT_HOST_HEADER } from "../http-headers";
import { resolveTenantHostForInternalApi } from "./resolve-tenant-host";

const API_INTERNAL_URL = process.env["API_INTERNAL_URL"] ?? "http://127.0.0.1:3001";

export type InviteAcceptContext = {
  isAuthenticated: boolean;
  signedInEmail: string | null;
  invitedEmail: string | null;
  inviteValid: boolean;
};

async function readSignedInEmail(): Promise<string | null> {
  const headerList = await headers();
  const request = new Request("https://placeholder.local", {
    headers: { cookie: headerList.get("cookie") ?? "" },
  });
  const accessToken = await extractAccessToken(request);

  if (!accessToken) {
    return null;
  }

  const supabase = createSupabaseAdminServerClient();
  const result = await supabase.auth.getUser(accessToken);

  return result.data.user?.email?.trim().toLowerCase() ?? null;
}

async function readInvitePreview(
  token: string,
): Promise<{ invitedEmail: string | null; inviteValid: boolean }> {
  const forwardedHost = await resolveTenantHostForInternalApi();
  const url = new URL("/api/v1/public/invitations/preview", API_INTERNAL_URL);
  url.searchParams.set("token", token);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-forwarded-host": forwardedHost,
        [ATLAS_INTERNAL_TENANT_HOST_HEADER]: forwardedHost,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      return { invitedEmail: null, inviteValid: false };
    }

    const payload = (await response.json()) as {
      data?: { invitedEmail?: string };
    };

    return {
      invitedEmail: payload.data?.invitedEmail?.trim().toLowerCase() ?? null,
      inviteValid: true,
    };
  } catch {
    return { invitedEmail: null, inviteValid: false };
  }
}

export async function loadInviteAcceptContext(token: string | undefined): Promise<InviteAcceptContext> {
  if (!token) {
    return {
      isAuthenticated: false,
      signedInEmail: null,
      invitedEmail: null,
      inviteValid: false,
    };
  }

  const [signedInEmail, preview] = await Promise.all([
    readSignedInEmail(),
    readInvitePreview(token),
  ]);

  return {
    isAuthenticated: Boolean(signedInEmail),
    signedInEmail,
    invitedEmail: preview.invitedEmail,
    inviteValid: preview.inviteValid,
  };
}
