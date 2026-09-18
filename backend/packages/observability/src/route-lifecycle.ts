import { structuredLogger } from "./logger";
import { runWithObservabilityContext } from "./request-context";
import type { SafeSentryTags } from "./sentry/tags";
import { applySafeSentryTags, captureUnexpectedError } from "./sentry/capture";
import { isExpectedClientError } from "./sentry/expected-errors";

export type RouteLifecycleContext = {
  requestId: string;
  route: string;
  routeGroup?: string;
  tenantSafeId?: string;
  actorSafeId?: string;
  actorPlane?: "tenant" | "platform" | "public";
  /**
   * Maps a thrown error to the error code the route will actually respond with.
   *
   * The lifecycle logs the failure and rethrows; the response envelope is built
   * one level up, in the route factory's catch. Without this hook the logger has
   * to guess, and its guess drifted: a Zod validation failure carries no `.code`
   * property, so every malformed request across the API was logged as
   * `INTERNAL_ERROR` while correctly answering `400 VALIDATION_ERROR`. Callers
   * pass the same envelope function they answer with, so the log line and the
   * response cannot disagree.
   */
  classifyError?: (error: unknown) => string;
};

/**
 * Last-resort classification for callers that pass no `classifyError`.
 *
 * Deliberately mirrors `toSafeErrorEnvelope` in `@atlas/core`: a coded error
 * reports its code, a Zod failure is a client validation error, and anything
 * else is a genuine fault. `PlatformScopeError` is absent on purpose — the
 * envelope has no case for it either, so it really does answer 500, and naming
 * it here would trade one inaccurate log for another.
 */
export function classifyRouteErrorCode(error: unknown): string {
  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    return error.code;
  }

  if (error instanceof Error && error.name === "ZodError") {
    return "VALIDATION_ERROR";
  }

  return "INTERNAL_ERROR";
}

export function inferRouteGroup(pathname: string): string {
  if (pathname.startsWith("/api/v1/platform")) {
    return "platform";
  }

  if (pathname.startsWith("/api/v1/public")) {
    return "public";
  }

  if (pathname.startsWith("/api/v1")) {
    return "tenant-api";
  }

  if (pathname.startsWith("/platform")) {
    return "platform-ui";
  }

  return "app";
}

export async function runRouteLifecycle<T>(
  context: RouteLifecycleContext,
  handler: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  const routeGroup = context.routeGroup ?? inferRouteGroup(context.route);
  const sentryTags: SafeSentryTags = {
    requestId: context.requestId,
    route: context.route,
    routeGroup,
    ...(context.tenantSafeId ? { tenantSafeId: context.tenantSafeId } : {}),
    ...(context.actorSafeId ? { actorSafeId: context.actorSafeId } : {}),
    ...(context.actorPlane ? { actorPlane: context.actorPlane } : {}),
  };

  applySafeSentryTags(sentryTags);

  structuredLogger.info({
    message: "route.start",
    requestId: context.requestId,
    route: context.route,
    routeGroup,
    ...(context.tenantSafeId ? { tenantSafeId: context.tenantSafeId } : {}),
    ...(context.actorSafeId ? { actorSafeId: context.actorSafeId } : {}),
    module: "route",
  });

  try {
    const result = await runWithObservabilityContext(
      {
        requestId: context.requestId,
        route: context.route,
        routeGroup,
        ...(context.tenantSafeId ? { tenantSafeId: context.tenantSafeId } : {}),
        ...(context.actorSafeId ? { actorSafeId: context.actorSafeId } : {}),
        ...(context.actorPlane ? { actorPlane: context.actorPlane } : {}),
      },
      handler,
    );

    structuredLogger.info({
      message: "route.complete",
      requestId: context.requestId,
      route: context.route,
      routeGroup: sentryTags.routeGroup,
      durationMs: Date.now() - startedAt,
      statusCode: 200,
      module: "route",
    });

    return result;
  } catch (error) {
    const errorCode = context.classifyError
      ? context.classifyError(error)
      : classifyRouteErrorCode(error);

    structuredLogger.error({
      message: "route.failure",
      requestId: context.requestId,
      route: context.route,
      routeGroup: sentryTags.routeGroup,
      durationMs: Date.now() - startedAt,
      errorCode,
      ...(process.env["NODE_ENV"] === "development" && error instanceof Error
        ? { errorMessage: error.message }
        : {}),
      module: "route",
    });

    if (!isExpectedClientError(error)) {
      captureUnexpectedError(error, sentryTags);
    }

    throw error;
  }
}

export function attachRequestIdHeader<T extends Response>(response: T, requestId: string): T {
  response.headers.set("x-request-id", requestId);
  return response;
}
