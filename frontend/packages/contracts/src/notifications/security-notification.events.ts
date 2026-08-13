import { z } from "zod";

export const SECURITY_NOTIFICATION_EVENT_KEYS = [
  "security.password_changed",
  "security.email_changed",
  "security.phone_changed",
  "security.signin_method_linked",
  "security.signin_method_removed",
  "security.mfa_enabled",
  "security.mfa_disabled",
] as const;

export type SecurityNotificationEventKey = (typeof SECURITY_NOTIFICATION_EVENT_KEYS)[number];

export const securityNotificationOutboxPayloadSchema = z.object({
  membershipId: z.uuid(),
  email: z.email(),
  siteUrl: z.url().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export type SecurityNotificationOutboxPayload = z.infer<
  typeof securityNotificationOutboxPayloadSchema
>;
