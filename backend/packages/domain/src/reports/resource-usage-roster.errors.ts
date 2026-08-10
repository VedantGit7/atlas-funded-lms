import { AtlasHttpError } from "@atlas/core/http/errors";

export function resourceUsageMetricNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Resource usage metric not found.",
  });
}

export function resourceUsageDormantCourseNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Course not found.",
  });
}
