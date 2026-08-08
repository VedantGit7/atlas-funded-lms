import { AtlasHttpError } from "@atlas/core/http/errors";

export function customFieldSegmentNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Segment not found.",
  });
}

export function customFieldSegmentInvalidConditions(message: string) {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 400,
    message,
  });
}

export function customFieldSegmentEmptyAudience() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 400,
    message: "No learners matched this segment.",
  });
}
