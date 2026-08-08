import { AtlasHttpError } from "@atlas/core/http/errors";

export function zoomNotConnected(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message: "Zoom is not connected for this tenant.",
  });
}
