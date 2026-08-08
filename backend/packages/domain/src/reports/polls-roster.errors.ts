import { AtlasHttpError } from "@atlas/core/http/errors";

export function pollRosterNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Poll not found.",
  });
}

export function liveSessionPollReportNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Live session not found.",
  });
}

export function pollCompareInsufficient() {
  return new AtlasHttpError({
    code: "VALIDATION_FAILED",
    status: 400,
    message: "Select between 2 and 4 polls to compare.",
  });
}

export function pollOptionNotFound() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Poll option not found.",
  });
}

export function pollRosterRespondentsHidden() {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 403,
    message: "Respondent details are hidden because anonymous voting is enabled for this poll.",
  });
}
