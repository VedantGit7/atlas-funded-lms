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
