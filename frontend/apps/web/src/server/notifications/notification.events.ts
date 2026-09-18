// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

export const NOTIFICATION_QUEUED_EVENT = "notification.queued" as const;

export const NOTIFICATION_SOURCE_EVENT_KEYS = [
  "certificate.issued",
  "certificate.revoked",
] as const;

export type NotificationSourceEventKey = (typeof NOTIFICATION_SOURCE_EVENT_KEYS)[number];

export {
  certificateIssuedOutboxPayloadSchema,
  certificateRevokedOutboxPayloadSchema,
} from "../certificates/certificate.dto";
