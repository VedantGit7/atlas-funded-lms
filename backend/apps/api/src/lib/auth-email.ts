import { randomUUID } from "node:crypto";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { AuthEmail } from "@atlas/auth";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import type { TenantTx } from "@atlas/db";
import { readRuntimeBrandingProjection } from "@atlas/domain-branding";
import { getTenantBranding } from "@atlas/domain-branding/repositories/branding.repository";
import { TenantThemeTokensSchema } from "@atlas/domain-branding/schemas/theme";
import { resolveBrandingAssetUrl } from "@atlas/storage";
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
 * back to the same host. Each carries the academy's branding (task 3.6): its
 * logo, primary colour and support address, in one layout.
 *
 * A failed send is logged, never shown: the answer to "send me a link" is the
 * same whether or not the address has an account.
 */
export async function sendAuthEmails(args: {
  req: Request;
  requestId: string;
  emails: AuthEmail[];
  /**
   * A route already inside the academy's transaction passes it, so the sender
   * is read on that connection rather than a second one (audit H3).
   */
  tenant?: { tx: TenantTx; tenantId: string };
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
    const sender = args.tenant
      ? await senderFor(args.tenant.tx, args.tenant.tenantId)
      : await resolveSender(host, args.requestId);
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
} & EmailBrand;

/** What the layout shows of the academy. */
export type EmailBrand = {
  logoUrl: string | null;
  /** A hex colour from the academy's theme, or the platform default. */
  primaryColor: string;
  supportEmail: string | null;
};

export const DEFAULT_BRAND_COLOR = "#1B2A4A";

/**
 * Only a plain hex colour reaches the email's styles: the theme is an admin's
 * input, and anything else could break out of the style attribute.
 */
export function safeBrandColor(value: unknown): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(value.trim())
    ? value.trim()
    : DEFAULT_BRAND_COLOR;
}

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
      logoUrl: null,
      primaryColor: DEFAULT_BRAND_COLOR,
      supportEmail: null,
    };
  }
  return withTenantTx(
    { tenantId: tenant.tenantId, requestId, allowAnonymousTenantRead: true },
    (tx) => senderFor(tx, tenant.tenantId),
  );
}

/**
 * The academy's name, branding and Transactional Email sender, read in its
 * transaction. The logo is the published light-background one, and only once
 * its upload is confirmed (audit M8); the colour is the theme's primary.
 */
export async function senderFor(tx: TenantTx, tenantId: string): Promise<Sender> {
  const branding = await getTenantBranding(tx);
  const projection = await readRuntimeBrandingProjection(tx);
  const [channel, support, logoUrl] = await Promise.all([
    readTenantEmailChannel(tx, "transactionalEmail"),
    readTenantEmailChannel(tx, "supportEmail"),
    resolveBrandingAssetUrl(tx, { tenantId }, projection.logoLightRefId),
  ]);
  const theme = TenantThemeTokensSchema.safeParse(projection.themeTokens);
  const supportEmail = support.fromEmail.trim();
  return {
    tenantId,
    academyName:
      branding?.public_name?.trim() || branding?.display_name.trim() || DEFAULT_ACADEMY_NAME,
    ...channelSender(channel),
    replyToEmail: channel.replyToEmail,
    logoUrl,
    primaryColor: safeBrandColor(theme.success ? theme.data.primary : null),
    supportEmail: /^[^s@<>"]+@[^s@<>"]+$/.test(supportEmail) ? supportEmail : null,
  };
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

/** Which confirm-page type each email's link carries, for the API's confirm route. */
const CONFIRM_TYPE: Partial<Record<AuthEmail["kind"], string>> = {
  "verify-email": "signup",
  "verify-new-email": "email_change",
  "confirm-email-change": "email_change",
  "magic-link": "magiclink",
};

/**
 * Links land on our own pages, never on Better Auth's handler, which isn't
 * mounted: /auth/confirm verifies the token and signs in, as Supabase's links
 * do, /reset-password asks for the new password, and /invite/accept opens an
 * invitation.
 */
export function authEmailLink(email: AuthEmail, origin: string): string {
  if (email.kind === "invitation") {
    const url = new URL("/invite/accept", origin);
    url.searchParams.set("token", email.token);
    return url.toString();
  }
  const type = CONFIRM_TYPE[email.kind];
  if (!type) {
    const url = new URL("/reset-password", origin);
    url.searchParams.set("token", email.token);
    return url.toString();
  }
  const url = new URL("/auth/confirm", origin);
  url.searchParams.set("token_hash", email.token);
  url.searchParams.set("type", type);
  return url.toString();
}

/** The words of each email; the layout adds the academy's branding. */
type AuthEmailContent = {
  subject: string;
  /** Already escaped. */
  headingHtml: string;
  /** Already escaped. */
  introHtml: string;
  actionLabel: string;
  footnote: string;
};

function contentFor(email: AuthEmail, academyName: string): AuthEmailContent {
  const name = escapeHtml(academyName);
  switch (email.kind) {
    case "verify-email":
      return {
        subject: `Confirm your email for ${academyName}`,
        headingHtml: "Confirm your email",
        introHtml: `Confirm your email address to finish creating your ${name} account.`,
        actionLabel: "Confirm my email",
        footnote:
          "The link works once and expires in 24 hours. If you didn't sign up, you can ignore this email.",
      };
    case "magic-link":
      return {
        subject: `Your ${academyName} sign-in link`,
        headingHtml: "Sign in",
        introHtml: `Use this link to sign in to ${name}.`,
        actionLabel: "Sign in",
        footnote:
          "The link works once and expires in 10 minutes. If you didn't ask for it, you can ignore this email.",
      };
    case "confirm-email-change":
      return {
        subject: `Approve the new email for your ${academyName} account`,
        headingHtml: "Approve your new email",
        introHtml: `Someone asked to change the email address of your ${name} account to <strong>${escapeHtml(email.newEmail ?? "a new address")}</strong>.`,
        actionLabel: "Approve the change",
        footnote:
          "We'll then send a link to the new address, and the change happens when it's opened. If you didn't ask for this, ignore this email and change your password: your email stays as it is.",
      };
    case "verify-new-email":
      return {
        subject: `Confirm your new email for ${academyName}`,
        headingHtml: "Confirm your new email",
        introHtml: `Confirm this address to finish moving your ${name} account to it.`,
        actionLabel: "Confirm my new email",
        footnote:
          "The link works once and expires in 24 hours. If you didn't ask for this, you can ignore this email.",
      };
    case "reset-password":
      return {
        subject: `Reset your ${academyName} password`,
        headingHtml: "Reset your password",
        introHtml: `Someone asked to reset the password for your ${name} account.`,
        actionLabel: "Choose a new password",
        footnote:
          "The link works once and expires in 1 hour. If you didn't ask for this, you can ignore this email: your password hasn't changed.",
      };
    case "invitation":
      return {
        subject: `You're invited to join ${academyName}`,
        headingHtml: `Join ${name}`,
        introHtml: `You've been invited to join ${name}. Open the invitation to set up your account, or sign in if you already have one.`,
        actionLabel: "Accept the invitation",
        footnote: "If you weren't expecting this invitation, you can ignore this email.",
      };
  }
}

/**
 * One layout for every auth email: the academy's logo (or its name) under a
 * bar of its primary colour, the message, a button and the same link as text
 * for mail clients that hide buttons, and the support address.
 */
export function buildAuthEmail(
  email: AuthEmail,
  args: { origin: string; academyName: string } & Partial<EmailBrand>,
): { subject: string; body: string } {
  const content = contentFor(email, args.academyName);
  const link = escapeHtml(authEmailLink(email, args.origin));
  const color = safeBrandColor(args.primaryColor);
  const name = escapeHtml(args.academyName);
  const header = args.logoUrl
    ? `<img src="${escapeHtml(args.logoUrl)}" alt="${name}" height="40" style="display:block;height:40px;max-width:220px;border:0;">`
    : `<span style="font-size:20px;font-weight:700;color:#0F172A;">${name}</span>`;
  const support = args.supportEmail
    ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#64748b;">Questions? Write to <a href="mailto:${escapeHtml(args.supportEmail)}" style="color:${color};">${escapeHtml(args.supportEmail)}</a>.</p>`
    : "";
  const body = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(content.subject)}</title></head>
<body style="margin:0;padding:40px 16px;background:#f1f5f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
    <tr><td style="height:6px;background:${color};font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td style="padding:28px 40px 0;">${header}</td></tr>
    <tr><td style="padding:24px 40px 36px;">
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#0F172A;">${content.headingHtml}</h1>
      <p style="margin:0 0 28px;font-size:16px;line-height:1.6;color:#475569;">${content.introHtml}</p>
      <a href="${link}" style="display:inline-block;background:${color};color:#ffffff;font-size:15px;font-weight:700;line-height:48px;padding:0 28px;border-radius:10px;text-decoration:none;">${escapeHtml(content.actionLabel)}</a>
      <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#64748b;">If the button doesn't work, open this link:<br><a href="${link}" style="color:${color};word-break:break-all;">${link}</a></p>
      <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#64748b;">${escapeHtml(content.footnote)}</p>
      ${support}
    </td></tr>
  </table>
</body>
</html>`;
  return { subject: content.subject, body };
}

/**
 * Sends an academy invitation from the academy itself, with its branding
 * (launch plan task 3.6). With Supabase, Supabase sent it. Unlike the other
 * auth emails a failure is the admin's to see, so it throws: the caller's
 * transaction then rolls back the new invite token and the old one stays valid.
 */
export async function sendInvitationEmail(args: {
  tenantId: string;
  requestId: string;
  to: string;
  inviteUrl: string;
  /** The academy's transaction, when the caller is already in it (audit H3). */
  tx?: TenantTx;
}): Promise<void> {
  try {
    await deliverInvitation(args);
  } catch (error) {
    structuredLogger.warn({
      message: "Could not send an academy invitation",
      module: "auth",
      eventType: "auth.invitation_send_failed",
      requestId: args.requestId,
      detail: error instanceof Error ? error.message : "unknown",
    });
    // 503, not 502, as the Supabase path answers: a proxy may replace a 502
    // with its own page (staging, 30 October 2026).
    throw new AtlasHttpError({
      code: "SERVICE_UNAVAILABLE",
      status: 503,
      message: "Unable to send the invitation email. Please try again.",
    });
  }
}

async function deliverInvitation(args: {
  tenantId: string;
  requestId: string;
  to: string;
  inviteUrl: string;
  tx?: TenantTx;
}): Promise<void> {
  const provider = getEmailProvider();
  if (!provider.isConfigured()) throw new Error("No email provider is configured");

  const sender = args.tx
    ? await senderFor(args.tx, args.tenantId)
    : await withTenantTx(
        { tenantId: args.tenantId, requestId: args.requestId, allowAnonymousTenantRead: true },
        (tx) => senderFor(tx, args.tenantId),
      );
  const url = new URL(args.inviteUrl);
  const content = buildAuthEmail(
    { kind: "invitation", email: args.to, token: url.searchParams.get("token") ?? "" },
    { origin: url.origin, ...sender },
  );
  await provider.send({
    tenantId: args.tenantId,
    to: args.to,
    subject: content.subject,
    body: content.body,
    requestId: args.requestId,
    idempotencyKey: `auth-email:${randomUUID()}`,
    ...(sender.fromEmail ? { fromName: sender.fromName, fromEmail: sender.fromEmail } : {}),
    replyToEmail: sender.replyToEmail,
  });
}
