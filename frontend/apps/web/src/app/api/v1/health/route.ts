export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { headers } from "next/headers";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import { healthResponseSchema } from "@atlas/observability/health-schema";
import { readDeploymentEnvironment, readReleaseIdentifier } from "@atlas/observability/release";

export async function GET() {
  const headerList = await headers();
  const requestId = getOrCreateRequestId(headerList);
  const release = readReleaseIdentifier();
  const environment = readDeploymentEnvironment();

  const body = healthResponseSchema.parse({
    ok: true,
    service: "atlas-lms",
    status: "healthy",
    requestId,
    ...(release ? { release } : {}),
    ...(environment ? { environment } : {}),
  });

  return Response.json(body, {
    status: 200,
    headers: {
      "x-request-id": requestId,
      "cache-control": "no-store",
    },
  });
}
