export const NOTIFICATION_QUEUED_EVENT = "notification.queued" as const;

import { SECURITY_NOTIFICATION_EVENT_KEYS } from "./security-notification.events";

export const NOTIFICATION_SOURCE_EVENT_KEYS = [
  "certificate.issued",
  "certificate.revoked",
  ...SECURITY_NOTIFICATION_EVENT_KEYS,
] as const;

export type NotificationSourceEventKey = (typeof NOTIFICATION_SOURCE_EVENT_KEYS)[number];

export {
  certificateIssuedOutboxPayloadSchema,
  certificateRevokedOutboxPayloadSchema,
} from "../certificates/certificate.dto";
