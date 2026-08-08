import type { PublicRouteMetadata } from "@atlas/authorization/route-metadata";
import { assertPublicRouteMetadata } from "@atlas/authorization/route-metadata";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import { attachRequestIdHeader, inferRouteGroup, runRouteLifecycle } from "@atlas/observability";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { toSafeErrorEnvelope } from "./error-envelope";
import { enforcePublicRateLimit } from "./rate-limit";

export type { PublicRouteMetadata };

export function createPublicRouteHandler(
  metadata: PublicRouteMetadata,
  handler: (args: { req: NextRequest; requestId: string }) => Promise<NextResponse>,
) {
  assertPublicRouteMetadata(metadata);

  return async function publicRoute(req: NextRequest) {
    const requestId = getOrCreateRequestId(req.headers);
    const pathname = new URL(req.url).pathname;

    try {
      return await runRouteLifecycle(
        {
          requestId,
          route: pathname,
          routeGroup: inferRouteGroup(pathname),
          actorPlane: "public",
        },
        async () => {
          enforcePublicRateLimit({
            req,
            bucket: metadata.rateLimit,
            requestId,
          });

          const response = await handler({ req, requestId });
          return attachRequestIdHeader(response, requestId);
        },
      );
    } catch (error) {
      const safe = toSafeErrorEnvelope(error, requestId);
      return attachRequestIdHeader(
        NextResponse.json(safe.body, { status: safe.status }),
        requestId,
      );
    }
  };
}
