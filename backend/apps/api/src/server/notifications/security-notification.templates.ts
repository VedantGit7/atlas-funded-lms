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
    emailSubject: "Your FundedBeyond Academy password was changed",
    actionPath: "/reset-password",
  },
  "security.email_changed": {
    title: "Email address changed",
    body: "The email address on your account was just changed. If this wasn't you, secure your account right away.",
    emailSubject: "Your FundedBeyond Academy email address was changed",
    actionPath: "/reset-password",
  },
  "security.phone_changed": {
    title: "Phone number changed",
    body: "The phone number on your account was just changed. If this wasn't you, secure your account right away.",
    emailSubject: "Your FundedBeyond Academy phone number was changed",
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

export function buildSecurityEmailHtml(args: {
  eventType: SecurityNotificationEventKey;
  email: string;
  siteUrl: string;
  title?: string;
  body?: string;
  emailSubject?: string;
  actionPath?: string;
}): string {
  const template = getBuiltInSecurityTemplate(args.eventType);
  const title = args.title ?? template.title;
  const body = args.body ?? template.body;
  const emailSubject = args.emailSubject ?? template.emailSubject;
  const actionPath = args.actionPath ?? template.actionPath;
  const secureUrl = `${args.siteUrl.replace(/\/$/, "")}${actionPath}`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${emailSubject}</title></head>
<body style="margin:0;padding:40px 16px;background:#eef1f8;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;">
    <tr><td style="background:#1B2A4A;padding:32px 40px;color:#fff;font-size:20px;font-weight:700;">FundedBeyond <span style="color:#3D7BF0;">Academy</span></td></tr>
    <tr><td style="padding:36px 40px;">
      <span style="display:inline-block;background:#fef3f2;color:#b42318;font-size:12px;font-weight:700;text-transform:uppercase;padding:6px 12px;border-radius:999px;">Security notification</span>
      <h1 style="margin:20px 0 16px;font-size:26px;color:#0F172A;">${title}</h1>
      <p style="margin:0 0 8px;font-size:16px;line-height:1.6;color:#475569;">${body}</p>
      <p style="margin:0 0 28px;font-size:16px;line-height:1.6;color:#475569;">Account: <strong>${args.email}</strong></p>
      <a href="${secureUrl}" style="display:inline-block;background:#fff;color:#0F172A;font-size:15px;font-weight:700;line-height:50px;text-align:center;width:240px;border:1.5px solid #cbd5e1;border-radius:10px;text-decoration:none;">Secure my account</a>
    </td></tr>
  </table>
</body>
</html>`;
}
