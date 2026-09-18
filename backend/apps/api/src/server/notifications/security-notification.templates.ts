import type { SecurityNotificationEventKey } from "./security-notification.events";

type SecurityTemplateContent = {
  title: string;
  body: string;
  emailSubject: string;
  actionPath: string;
};

const SECURITY_TEMPLATES: Record<SecurityNotificationEventKey, SecurityTemplateContent> = {
  "security.password_changed": {
    title: "Password changed",
    body: "The password for your account was just changed. If this wasn't you, secure your account right away.",
    emailSubject: "Your {{academyName}} password was changed",
    actionPath: "/reset-password",
  },
  "security.email_changed": {
    title: "Email address changed",
    body: "The email address on your account was just changed. If this wasn't you, secure your account right away.",
    emailSubject: "Your {{academyName}} email address was changed",
    actionPath: "/reset-password",
  },
  "security.phone_changed": {
    title: "Phone number changed",
    body: "The phone number on your account was just changed. If this wasn't you, secure your account right away.",
    emailSubject: "Your {{academyName}} phone number was changed",
    actionPath: "/reset-password",
  },
  "security.signin_method_linked": {
    title: "Sign-in method added",
    body: "A new sign-in method was linked to your account. If this wasn't you, secure your account right away.",
    emailSubject: "A new sign-in method was added to your account",
    actionPath: "/settings",
  },
  "security.signin_method_removed": {
    title: "Sign-in method removed",
    body: "A sign-in method was removed from your account. If this wasn't you, secure your account right away.",
    emailSubject: "A sign-in method was removed from your account",
    actionPath: "/settings",
  },
  "security.mfa_enabled": {
    title: "Two-factor authentication added",
    body: "A new two-factor authentication method was added to your account.",
    emailSubject: "Two-factor authentication was added to your account",
    actionPath: "/settings",
  },
  "security.mfa_disabled": {
    title: "Two-factor authentication removed",
    body: "A two-factor authentication method was removed from your account. If this wasn't you, secure your account right away.",
    emailSubject: "Two-factor authentication was removed from your account",
    actionPath: "/settings",
  },
};

export function getBuiltInSecurityTemplate(
  eventType: SecurityNotificationEventKey,
): SecurityTemplateContent {
  return SECURITY_TEMPLATES[eventType];
}

/** Default used only when a tenant has not set a public name in branding. */
export const DEFAULT_ACADEMY_NAME = "Your academy";

/**
 * HTML-escapes a value before it is interpolated into the email body.
 *
 * `title`, `body` and `academyName` are all tenant-admin controlled (system
 * email templates and branding), and `email` is learner-controlled. None of
 * them were escaped, so any of those fields could inject markup into a
 * security email delivered to another user.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildSecurityEmailHtml(args: {
  eventType: SecurityNotificationEventKey;
  email: string;
  siteUrl: string;
  /** The tenant's branding public name. Falls back to a neutral default. */
  academyName?: string | null;
  title?: string;
  body?: string;
  emailSubject?: string;
  actionPath?: string;
}): string {
  const template = getBuiltInSecurityTemplate(args.eventType);
  // The subject templates carry a {{academyName}} placeholder rather than a
  // hardcoded brand: this is a white-label platform, and every tenant's
  // security emails previously said "FundedBeyond Academy".
  const academyName = args.academyName?.trim() || DEFAULT_ACADEMY_NAME;
  const fill = (value: string) => value.replaceAll("{{academyName}}", academyName);

  const title = escapeHtml(fill(args.title ?? template.title));
  const body = escapeHtml(fill(args.body ?? template.body));
  const emailSubject = escapeHtml(fill(args.emailSubject ?? template.emailSubject));
  const actionPath = args.actionPath ?? template.actionPath;
  const secureUrl = `${args.siteUrl.replace(/\/$/, "")}${actionPath}`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${emailSubject}</title></head>
<body style="margin:0;padding:40px 16px;background:#eef1f8;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;">
    <tr><td style="background:#1B2A4A;padding:32px 40px;color:#fff;font-size:20px;font-weight:700;">${escapeHtml(academyName)}</td></tr>
    <tr><td style="padding:36px 40px;">
      <span style="display:inline-block;background:#fef3f2;color:#b42318;font-size:12px;font-weight:700;text-transform:uppercase;padding:6px 12px;border-radius:999px;">Security notification</span>
      <h1 style="margin:20px 0 16px;font-size:26px;color:#0F172A;">${title}</h1>
      <p style="margin:0 0 8px;font-size:16px;line-height:1.6;color:#475569;">${body}</p>
      <p style="margin:0 0 28px;font-size:16px;line-height:1.6;color:#475569;">Account: <strong>${escapeHtml(args.email)}</strong></p>
      <a href="${secureUrl}" style="display:inline-block;background:#fff;color:#0F172A;font-size:15px;font-weight:700;line-height:50px;text-align:center;width:240px;border:1.5px solid #cbd5e1;border-radius:10px;text-decoration:none;">Secure my account</a>
    </td></tr>
  </table>
</body>
</html>`;
}
