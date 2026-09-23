import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    const { validateDeploymentStartup } = await import("@atlas/api/deployment-startup");
    validateDeploymentStartup("web");
    await import("../sentry.server.config");
  }

  if (process.env["NEXT_RUNTIME"] === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
