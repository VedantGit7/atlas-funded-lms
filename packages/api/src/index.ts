export { EntitlementRequiredError } from "./errors";
export { enforceEntitlement } from "@atlas/authorization";
export { toSafeErrorEnvelope } from "./error-envelope";
export { enforcePublicRateLimit, resetRateLimitsForTests } from "./rate-limit";
export { createPublicRouteHandler, type PublicRouteMetadata } from "./public-route";
export {
  runProtectedTenantRouteHandler,
  runProtectedTenantRoutePipeline,
  createTenantRoute,
  type ProtectedTenantRouteHandler,
} from "./create-tenant-route";
export { createPlatformRoute, type PlatformRouteHandler } from "./create-platform-route";
export { noBodySchema, emptyBodySchema } from "./schemas";
export { loadResourceRefOrDefault } from "./load-resource-ref";
export type {
  ResourceLoaderFn,
  RouteMetadata,
  TenantRouteContext,
  PlatformRouteContext,
  PlatformRouteMetadata,
} from "./route-metadata";
