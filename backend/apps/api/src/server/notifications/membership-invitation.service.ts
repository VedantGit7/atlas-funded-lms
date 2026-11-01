import { headers } from "next/headers";
import { authProvider, sendTenantInvitationEmail } from "@atlas/auth";
import type { TenantTx } from "@atlas/db";
import { sendInvitationEmail } from "../../lib/auth-email";

function isLocalHost(host: string): boolean {
  const name = host.split(":")[0] ?? "";
  return (
    name === "localhost" ||
    name === "127.0.0.1" ||
    name === "0.0.0.0" ||
    name.endsWith(".localhost") ||
    name.endsWith(".test")
  );
}

/**
 * Resolve the origin the admin is actually inviting from (tenant host + port),
 * not a DB/config default. The web proxy forwards the browser host on
 * `x-atlas-tenant-host` (and `x-forwarded-host`), so invites sent from
 * `fundedbeyond.localhost.test:3000` redirect back to that exact host. This is
 * what keeps the Supabase `redirect_to` inside the tenant's allow-listed URLs.
 */
async function resolveRequestOrigin(): Promise<string | null> {
  const headerList = await headers();

  const rawHost =
    headerList.get("x-atlas-tenant-host")?.trim() ||
    headerList.get("x-forwarded-host")?.trim() ||
    headerList.get("host")?.trim() ||
    "";

  if (!rawHost) {
    return null;
  }

  const proto =
    headerList.get("x-forwarded-proto")?.trim() || (isLocalHost(rawHost) ? "http" : "https");

  return `${proto}://${rawHost}`;
}

export async function sendMembershipInvitationEmail(args: {
  tenantId: string;
  requestId: string;
  to: string;
  inviteToken: string;
  /** The academy's transaction the invite was written in (audit H3). */
  tx?: TenantTx;
}): Promise<void> {
  const origin = (await resolveRequestOrigin()) ?? process.env["PUBLIC_SITE_URL"] ?? null;

  if (!origin) {
    throw new Error("Unable to resolve the tenant origin for the invitation link.");
  }

  const inviteUrl = `${origin.replace(/\/$/, "")}/invite/accept?token=${encodeURIComponent(
    args.inviteToken,
  )}`;

  if (process.env["NODE_ENV"] === "development") {
    console.info("[membership-invitation] Invite link (development):", {
      requestId: args.requestId,
      to: args.to,
      inviteUrl,
    });
  }

  if (authProvider() === "better-auth") {
    // Our own email, with the academy's branding (launch plan task 3.6).
    await sendInvitationEmail({
      tenantId: args.tenantId,
      requestId: args.requestId,
      to: args.to,
      inviteUrl,
      ...(args.tx ? { tx: args.tx } : {}),
    });
    return;
  }

  await sendTenantInvitationEmail({
    email: args.to,
    inviteUrl,
  });
}
