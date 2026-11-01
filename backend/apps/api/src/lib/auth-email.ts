import { randomUUID } from "node:crypto";
import type { AuthEmail } from "@atlas/auth";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { getTenantBranding } from "@atlas/domain-branding/repositories/branding.repository";
import { structuredLogger } from "@atlas/observability/logger";
import { lookupTenantFromHost, resolveRequestHostFromHeaders } from "@atlas/tenancy";
import {
  channelSender,
  getEmailProvider,
} from "../server/notifications/notification.email-provider";
import {
  DEFAULT_ACADEMY_NAME,
  escapeHtml,
} from "../server/notifications/security-notification.templates";
import { readTenantEmailChannel } from "../server/tenant-settings/tenant-settings.service";

/**
 * Sends the verification and password-reset emails Better Auth asked for
 * (launch plan task 3.2; docs/engineering/better-auth-design.md). Supabase
 * sent these itself, with one sender and one set of templates for every
 * academy. Here each goes from the academy whose site it was asked on, with
 * that academy's name and Transactional Email sender, and its link points
 * back to the same host. Task 3.6 gives them the academy's full branding.
 *
 * A failed send is logged, never shown: the answer to "send me a link" is the
 * same whether or not the address has an account.
 */
export async function sendAuthEmails(args: {
  req: Request;
  requestId: string;
  emails: AuthEmail[];
}): Promise<void> {
  if (args.emails.length === 0) return;
  const host = resolveRequestHostFromHeaders(args.req.headers);
  const provider = getEmailProvider();
  if (!provider.isConfigured()) {
    structuredLogger.warn({
      message: "No email provider is configured, so an auth email was not sent",
      module: "auth",
      eventType: "auth.email_not_sent",
      requestId: args.requestId,
    });
    return;
  }

  try {
    const sender = await resolveSender(host, args.requestId);
    const origin = requestOrigin(args.req);
    for (const email of args.emails) {
      const content = buildAuthEmail(email, { origin, ...sender });
      await provider.send({
        tenantId: sender.tenantId,
        to: email.email,
        subject: content.subject,
        body: content.body,
        requestId: args.requestId,
        // Nothing from the email Better Auth asked for: its token is a
        // credential, and the provider hashes this key into the Message-ID.
        idempotencyKey: `auth-email:${randomUUID()}`,
        ...(sender.fromEmail ? { fromName: sender.fromName, fromEmail: sender.fromEmail } : {}),
        replyToEmail: sender.replyToEmail,
      });
    }
  } catch (error) {
    structuredLogger.warn({
      message: "Could not send an auth email",
      module: "auth",
      eventType: "auth.email_send_failed",
      requestId: args.requestId,
      detail: error instanceof Error ? error.message : "unknown",
    });
  }
}

type Sender = {
  tenantId: string | null;
  academyName: string;
  fromName: string;
  fromEmail: string;
  replyToEmail: string | null;
};

/** The academy behind the host, or the platform's default sender on the console. */
async function resolveSender(host: string, requestId: string): Promise<Sender> {
  const tenant = await withGlobalDb((db) => lookupTenantFromHost({ host, requestId, db }));
  if (!tenant || tenant.tenantState !== "ACTIVE") {
    return {
      tenantId: null,
      academyName: "Atlas",
      fromName: "",
      fromEmail: "",
      replyToEmail: null,
    };
  }
  return withTenantTx(
    { tenantId: tenant.tenantId, requestId, allowAnonymousTenantRead: true },
    async (tx) => {
      const branding = await getTenantBranding(tx);
      const channel = await readTenantEmailChannel(tx, "transactionalEmail");
      return {
        tenantId: tenant.tenantId,
        academyName:
          branding?.public_name?.trim() || branding?.display_name.trim() || DEFAULT_ACADEMY_NAME,
        ...channelSender(channel),
        replyToEmail: channel.replyToEmail,
      };
    },
  );
}

/**
 * The origin the person is on: the resolved host, with the port the browser
 * used when it is that host's (local `academy.localhost.test:3000`).
 * Deployments serve https only; local hosts are plain http.
 */
export function requestOrigin(req: Request, env: NodeJS.ProcessEnv = process.env): string {
  const host = resolveRequestHostFromHeaders(req.headers);
  const raw = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "")
    .split(",")[0]
    ?.trim()
    .toLowerCase();
  const suffix = raw?.startsWith(host) ? raw.slice(host.length) : "";
  const port = /^:\d{1,5}$/.test(suffix) ? suffix : "";
  return `${env["NODE_ENV"] === "production" ? "https" : "http"}://${host}${port}`;
}

/**
 * Links land on our own pages, never on Better Auth's handler, which isn't
 * mounted: /auth/confirm verifies the email and signs in, as Supabase's
 * links do, and /reset-password asks for the new password.
 */
export function authEmailLink(email: AuthEmail, origin: string): string {
  const url =
    email.kind === "verify-email"
      ? new URL("/auth/confirm", origin)
      : new URL("/reset-password", origin);
  if (email.kind === "verify-email") {
    url.searchParams.set("token_hash", email.token);
    url.searchParams.set("type", "signup");
  } else {
    url.searchParams.set("token", email.token);
  }
  return url.toString();
}

export function buildAuthEmail(
  email: AuthEmail,
  args: { origin: string; academyName: string },
): { subject: string; body: string } {
  const name = escapeHtml(args.academyName);
  const link = escapeHtml(authEmailLink(email, args.origin));
  if (email.kind === "verify-email") {
    return {
      subject: `Confirm your email for ${args.academyName}`,
      body: [
        `<p>Confirm your email address to finish creating your ${name} account.</p>`,
        `<p><a href="${link}">Confirm my email</a></p>`,
        "<p>The link works once and expires in 24 hours. If you didn't sign up, you can ignore this email.</p>",
      ].join(""),
    };
  }
  return {
    subject: `Reset your ${args.academyName} password`,
    body: [
      `<p>Someone asked to reset the password for your ${name} account.</p>`,
      `<p><a href="${link}">Choose a new password</a></p>`,
      "<p>The link works once and expires in 1 hour. If you didn't ask for this, you can ignore this email: your password hasn't changed.</p>",
    ].join(""),
  };
}
