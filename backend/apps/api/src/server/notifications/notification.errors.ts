import { AtlasHttpError } from "@atlas/core/http/errors";

export function notificationTemplateNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Notification template not found.",
  });
}

export function notificationDispatchNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Notification not found.",
  });
}

export function notificationTemplateKeyConflict(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "A notification template with this key, channel, and locale already exists.",
  });
}

export function notificationTemplateInvalidKey(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "Template key must match a registered source event type.",
  });
}
