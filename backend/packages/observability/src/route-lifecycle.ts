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
};

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
    const errorCode =
      error instanceof Error && "code" in error && typeof error.code === "string"
        ? error.code
        : "INTERNAL_ERROR";

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
