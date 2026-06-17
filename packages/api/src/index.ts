export { EntitlementRequiredError } from "./errors";
export { enforceEntitlement } from "@atlas/authorization";
export { toSafeErrorEnvelope } from "./error-envelope";
export {
  runProtectedTenantRouteHandler,
  runProtectedTenantRoutePipeline,
  createTenantRoute,
  type ProtectedTenantRouteHandler,
} from "./create-tenant-route";
export { noBodySchema } from "./schemas";
export { loadResourceRefOrDefault } from "./load-resource-ref";
export type { ResourceLoaderFn, RouteMetadata, TenantRouteContext } from "./route-metadata";
