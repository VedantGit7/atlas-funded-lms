import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    const { validateDeploymentStartup } = await import("@atlas/api/deployment-startup");
    validateDeploymentStartup("api");
    await import("../sentry.server.config");
    // Background: readiness is not delayed (audit M8 follow-up).
    const { warmSvgSanitizer } = await import("./server/warm-svg-sanitizer");
    void warmSvgSanitizer();
    // Background: an R2 bucket that would refuse browser uploads is an error
    // event at deploy time, not a silent upload failure (audit M8).
    const { checkR2UploadCors } = await import("./server/check-r2-upload-cors");
    void checkR2UploadCors();
  }

  if (process.env["NEXT_RUNTIME"] === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
