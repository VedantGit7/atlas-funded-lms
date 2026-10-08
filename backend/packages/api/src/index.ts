export { EntitlementRequiredError } from "./errors";
export { enforceEntitlement } from "@atlas/authorization";
export { toSafeErrorEnvelope } from "./error-envelope";
export { assertSameOrigin } from "./assert-same-origin";
export {
  assertRedirectOnRequestHost,
  assertRedirectOnRequestHostFrom,
  type RedirectField,
} from "./redirect-target";
export { enforcePublicRateLimit, resetRateLimitsForTests } from "./rate-limit";
export {
  MemoryRateLimitStore,
  RedisRateLimitStore,
  resolveRateLimitStore,
  setRateLimitStore,
  type RateLimitStore,
  type RateLimitHit,
  type RateLimitRedisClient,
} from "./rate-limit-store";
export { resolveClientIp } from "./client-ip";
export { createPublicRouteHandler, type PublicRouteMetadata } from "./public-route";
export {
  authenticateTenantRequest,
  globalDbPerStatement,
  resolveRequestTenant,
  type ResolvedRequestTenant,
} from "./request-tenant";
export {
  runProtectedTenantRouteHandler,
  runProtectedTenantRoutePipeline,
  enforceTenantRouteRateLimit,
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
