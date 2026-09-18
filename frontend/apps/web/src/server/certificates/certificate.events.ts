// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

export {
  certificateIssuedOutboxPayloadSchema,
  certificateRevokedOutboxPayloadSchema,
} from "./certificate.dto";

export const CERTIFICATE_ISSUED_EVENT = "certificate.issued" as const;
export const CERTIFICATE_REVOKED_EVENT = "certificate.revoked" as const;
export const CERTIFICATE_EXPIRED_EVENT = "certificate.expired" as const;
export const CERTIFICATE_SUSPENDED_EVENT = "certificate.suspended" as const;

export const CERTIFICATE_AUDIT_ISSUED = "credential.issued" as const;
export const CERTIFICATE_AUDIT_REVOKED = "credential.revoked" as const;
export const CERTIFICATE_TEMPLATE_DELETED = "certificate_template.deleted" as const;
