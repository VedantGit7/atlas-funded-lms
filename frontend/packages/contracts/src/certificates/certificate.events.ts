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
