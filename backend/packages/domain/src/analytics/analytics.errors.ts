import { AtlasHttpError } from "@atlas/core/http/errors";

export function unknownAnalyticsDashboardKey(key: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: `Unknown dashboard key: ${key}`,
  });
}

export function unknownAnalyticsFunnelKey(key: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: `Unknown funnel key: ${key}`,
  });
}

export function unknownItemStatisticsWindowKey(key: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: `Unknown item statistics window key: ${key}`,
  });
}

export function invalidAnalyticsDateRange(message: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}

export function analyticsCourseScopeRequired(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "courseId is required for course-scoped dashboards.",
  });
}

export function analyticsAssessmentScopeRequired(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "assessmentId is required.",
  });
}
