import { NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { createPublicRouteHandler } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { hashClientIp } from "@atlas/security";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { publicCredentialParamsSchema } from "../../../../../../server/certificates/certificate.params";
import { publicVerifyResponseSchema } from "../../../../../../server/certificates/certificate.dto";
import { verifyCredentialPublic } from "../../../../../../server/certificates/certificate.service";
import { routeMetadata } from "./route.metadata";

/**
 * Supplementary in-memory sliding-window rate limit for public credential
 * verification (max 60 requests / minute per hashed client IP).
 *
 * The framework-level `enforcePublicRateLimit` (publicRead bucket) remains the
 * primary guard; this narrower window adds abuse resistance specific to the
 * public verify surface. Best-effort only — a single process holds the window,
 * so it is not a substitute for an edge/CDN rate limiter in production. Tests
 * exercise `verifyCredentialPublic` directly and are unaffected.
 */
const VERIFY_WINDOW_MS = 60_000;
const VERIFY_MAX_PER_WINDOW = 60;
const verifyHits = new Map<string, number[]>();

function enforceVerifyRateLimit(req: Request): void {
  const key = hashClientIp(req) ?? "unknown";
  const now = Date.now();
  const recent = (verifyHits.get(key) ?? []).filter((ts) => now - ts < VERIFY_WINDOW_MS);
  if (recent.length >= VERIFY_MAX_PER_WINDOW) {
    throw new AtlasHttpError({
      code: "INTERNAL_ERROR",
      status: 429,
      message: "Too many verification requests. Please try again later.",
    });
  }
  recent.push(now);
  verifyHits.set(key, recent);
}

export const GET = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  enforceVerifyRateLimit(req);
  return withGlobalDb(async (db) => {
    const tenant = await resolveTenantFromRequest({ req, db });
    const url = new URL(req.url);
    const segments = url.pathname.split("/");
    const credentialId = segments.at(-1) ?? "";
    publicCredentialParamsSchema.parse({ credentialId });

    const body = await withTenantTx(
      {
        tenantId: tenant.tenantId,
        requestId,
        allowAnonymousTenantRead: true,
      },
      async (tx) =>
        verifyCredentialPublic({
          tx,
          tenantId: tenant.tenantId,
          requestId,
          credentialId,
          req,
        }),
    );

    return NextResponse.json(publicVerifyResponseSchema.parse(body));
  });
});
