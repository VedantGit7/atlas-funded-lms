import type { RateLimitBucket } from "@atlas/authorization/route-metadata";
import { AtlasHttpError } from "@atlas/core/http/errors";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitEntry>();

const BUCKET_LIMITS: Record<RateLimitBucket, { max: number; windowMs: number }> = {
  publicRead: { max: 120, windowMs: 60_000 },
  publicAuth: { max: 20, windowMs: 60_000 },
  publicInvitationAccept: { max: 10, windowMs: 60_000 },
  publicDiagnostic: { max: 10, windowMs: 60_000 },
  authenticatedTenantRead: { max: 240, windowMs: 60_000 },
  authenticatedTenantWrite: { max: 60, windowMs: 60_000 },
};

function getClientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }

  return req.headers.get("x-real-ip") ?? "unknown";
}

export function enforcePublicRateLimit(args: {
  req: Request;
  bucket: RateLimitBucket;
  requestId: string;
}): void {
  const config = BUCKET_LIMITS[args.bucket];
  const key = `${args.bucket}:${getClientKey(args.req)}`;
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + config.windowMs });
    return;
  }

  if (current.count >= config.max) {
    throw new AtlasHttpError({
      code: "INTERNAL_ERROR",
      status: 429,
      message: "Too many requests. Please try again later.",
    });
  }

  current.count += 1;
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
}
