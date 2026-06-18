import type { PublicRouteMetadata } from "@atlas/authorization/route-metadata";
import { assertPublicRouteMetadata } from "@atlas/authorization/route-metadata";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { toSafeErrorEnvelope } from "./error-envelope";
import { enforcePublicRateLimit } from "./rate-limit";

export type { PublicRouteMetadata };

export function createPublicRouteHandler<T>(
  metadata: PublicRouteMetadata,
  handler: (args: { req: NextRequest; requestId: string }) => Promise<NextResponse<T>>,
) {
  assertPublicRouteMetadata(metadata);

  return async function publicRoute(req: NextRequest) {
    const requestId = getOrCreateRequestId(req.headers);

    try {
      enforcePublicRateLimit({
        req,
        bucket: metadata.rateLimit,
        requestId,
      });

      return await handler({ req, requestId });
    } catch (error) {
      const safe = toSafeErrorEnvelope(error, requestId);
      return NextResponse.json(safe.body, { status: safe.status });
    }
  };
}
