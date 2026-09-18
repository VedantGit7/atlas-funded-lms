import type { RouteMetadata } from "@atlas/api/route-metadata";
import { postRouteMetadata } from "../route.metadata";

/**
 * `blob/route.ts` in this app is a streaming pass-through to the backend's
 * `POST /api/v1/lessons/[id]/assets/blob`, which runs the real
 * `createTenantRoute` pipeline. Enforcement — permission, entitlement, audit,
 * rate limit and idempotency — happens there, not here.
 *
 * This declaration exists so the proxied contract is discoverable from the
 * route it fronts rather than only from the backend tree, and so
 * `atlas/require-route-metadata` can see it. It reuses the sibling asset-write
 * metadata, which is the same contract the backend applies
 * (`postBlobRouteMetadata` is an alias of `postUploadRouteMetadata`), so the
 * two cannot drift apart independently.
 */
export const routeMetadata = postRouteMetadata satisfies RouteMetadata;
