import { AtlasHttpError } from "@atlas/core/http/errors";

export function certificateTemplateNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Certificate template not found.",
  });
}

export function certificateNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Certificate not found.",
  });
}

export function certificateBrandKitNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Certificate brand kit not found.",
  });
}

export function certificateTemplateKeyConflict(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "A certificate template with this key already exists.",
  });
}

export function certificateTemplateNotEditable(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "Only draft templates can be edited.",
  });
}

export function certificateTemplateNotPublishable(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "Only draft templates can be published.",
  });
}

export function certificateTemplateNotApprovable(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "Only templates in review can be approved.",
  });
}

export function certificateDownloadNotReady(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "Certificate has not been rendered yet. Render the certificate before downloading.",
  });
}

export function certificateWorkflowNotConfigured(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "Certificate workflow is not configured for this tenant.",
  });
}

export function certificateIssueConflict(message: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message,
  });
}

export function certificateRevokeConflict(message: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message,
  });
}

export function certificateEntitlementRequired(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 403,
    message: "Certification is not enabled for this tenant.",
  });
}

export function invalidTargetMembership(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "Recipient membership is not active.",
  });
}
