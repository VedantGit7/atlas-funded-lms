import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    const { validateDeploymentStartup } = await import("@atlas/api/deployment-startup");
    validateDeploymentStartup("api");
    await import("../sentry.server.config");
    // Background: readiness is not delayed (audit M8 follow-up).
    const { warmSvgSanitizer } = await import("./server/warm-svg-sanitizer");
    void warmSvgSanitizer();
  }

  if (process.env["NEXT_RUNTIME"] === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
