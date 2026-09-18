import type { NOTIFICATION_SOURCE_EVENT_KEYS } from "../notifications/notification.events";
import { getBuiltInSecurityTemplate } from "../notifications/security-notification.templates";
import type { SecurityNotificationEventKey } from "../notifications/security-notification.events";

export type SystemEmailVariableDef = {
  key: string;
  sample: string;
  description: string;
};

export type SystemEmailCatalogEntry = {
  key: (typeof NOTIFICATION_SOURCE_EVENT_KEYS)[number];
  name: string;
  description: string;
  category: "certificates" | "security";
  defaultSubject: string;
  defaultBody: string;
  defaultTitle: string;
  defaultActionPath: string;
  variables: readonly SystemEmailVariableDef[];
};

export function sampleVariablesFromDefs(
  variables: readonly SystemEmailVariableDef[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const variable of variables) {
    result[variable.key] = variable.sample;
  }
  return result;
}

function securityEntry(
  key: SecurityNotificationEventKey,
  name: string,
  description: string,
): SystemEmailCatalogEntry {
  const builtIn = getBuiltInSecurityTemplate(key);
  return {
    key,
    name,
    description,
    category: "security",
    defaultSubject: builtIn.emailSubject,
    defaultBody: builtIn.body,
    defaultTitle: builtIn.title,
    defaultActionPath: builtIn.actionPath,
    variables: [
      {
        key: "email",
        sample: "learner@example.com",
        description: "The learner email address associated with the account change.",
      },
      {
        key: "siteUrl",
        sample: "https://example.com",
        description: "Your academy site URL used in security links and context.",
      },
    ],
  };
}

export const SYSTEM_EMAIL_CATALOG: readonly SystemEmailCatalogEntry[] = [
  {
    key: "certificate.issued",
    name: "Certificate issued",
    description: "Sent when a learner is awarded a certificate.",
    category: "certificates",
    defaultSubject: "Your certificate is ready",
    defaultBody:
      "Congratulations! Your certificate was issued on {{issuedAt}}. Open your certificates to download it.",
    defaultTitle: "Certificate issued",
    defaultActionPath: "/certificates",
    variables: [
      {
        key: "issuedAt",
        sample: "24 Jul 2026",
        description: "The date the certificate was issued.",
      },
      {
        key: "certificateId",
        sample: "cert_sample_001",
        description: "The unique identifier of the issued certificate.",
      },
    ],
  },
  {
    key: "certificate.revoked",
    name: "Certificate revoked",
    description: "Sent when a previously issued certificate is revoked.",
    category: "certificates",
    defaultSubject: "A certificate was revoked",
    defaultBody:
      "A certificate associated with your account was revoked on {{revokedAt}}. Contact support if you have questions.",
    defaultTitle: "Certificate revoked",
    defaultActionPath: "/certificates",
    variables: [
      {
        key: "revokedAt",
        sample: "24 Jul 2026",
        description: "The date the certificate was revoked.",
      },
      {
        key: "certificateId",
        sample: "cert_sample_001",
        description: "The unique identifier of the revoked certificate.",
      },
    ],
  },
  securityEntry(
    "security.password_changed",
    "Password changed",
    "Sent when the learner changes their password.",
  ),
  securityEntry(
    "security.email_changed",
    "Email address changed",
    "Sent when the learner changes their email address.",
  ),
  securityEntry(
    "security.phone_changed",
    "Phone number changed",
    "Sent when the learner changes their phone number.",
  ),
  securityEntry(
    "security.signin_method_linked",
    "Sign-in method added",
    "Sent when a new sign-in method is linked to the account.",
  ),
  securityEntry(
    "security.signin_method_removed",
    "Sign-in method removed",
    "Sent when a sign-in method is removed from the account.",
  ),
  securityEntry(
    "security.mfa_enabled",
    "Two-factor authentication added",
    "Sent when MFA is enabled on the account.",
  ),
  securityEntry(
    "security.mfa_disabled",
    "Two-factor authentication removed",
    "Sent when MFA is disabled on the account.",
  ),
] as const;

export function getSystemEmailCatalogEntry(key: string): SystemEmailCatalogEntry | null {
  return SYSTEM_EMAIL_CATALOG.find((entry) => entry.key === key) ?? null;
}

export function renderSystemEmailText(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_match, name: string) => {
    return variables[name] ?? "";
  });
}
