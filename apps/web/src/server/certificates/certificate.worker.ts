import {
  certificateIssuedOutboxPayloadSchema,
  certificateRevokedOutboxPayloadSchema,
} from "./certificate.dto";
import { CERTIFICATE_ISSUED_EVENT, CERTIFICATE_REVOKED_EVENT } from "./certificate.events";

export const CERTIFICATE_WORKER_DESTINATION = "certificates";

export function handleCertificateOutboxEvent(event: {
  id: string;
  eventType: string;
  tenantId: string | null;
  payload: unknown;
  requestId: string;
}): Promise<void> {
  if (event.tenantId == null) {
    return Promise.reject(new Error("Certificate worker requires tenant-scoped events."));
  }

  if (event.eventType === CERTIFICATE_ISSUED_EVENT) {
    certificateIssuedOutboxPayloadSchema.parse(event.payload);
    return Promise.resolve();
  }

  if (event.eventType === CERTIFICATE_REVOKED_EVENT) {
    certificateRevokedOutboxPayloadSchema.parse(event.payload);
    return Promise.resolve();
  }

  return Promise.resolve();
}

export const certificateOutboxHandlers = [
  {
    destinationKey: CERTIFICATE_WORKER_DESTINATION,
    handle: handleCertificateOutboxEvent,
  },
];

export function processCertificateOutboxBatch(): void {
  // Event-contract validation only in ATL-STORY-030.
}
