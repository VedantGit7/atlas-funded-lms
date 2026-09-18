import type { RateLimitBucket } from "@atlas/authorization/route-metadata";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { resolveClientIp } from "./client-ip";
import {
  MemoryRateLimitStore,
  resolveRateLimitStore,
  setRateLimitStore,
  type RateLimitStore,
} from "./rate-limit-store";

const BUCKET_LIMITS: Record<RateLimitBucket, { max: number; windowMs: number }> = {
  publicRead: { max: 120, windowMs: 60_000 },
  publicAuth: { max: 20, windowMs: 60_000 },
  publicInvitationAccept: { max: 10, windowMs: 60_000 },
  publicDiagnostic: { max: 10, windowMs: 60_000 },
  authenticatedTenantRead: { max: 240, windowMs: 60_000 },
  authenticatedTenantWrite: { max: 60, windowMs: 60_000 },
};

/**
 * Per-process backstop used only when the shared store is unreachable. Losing
 * Redis must not take the platform down (a limiter is a mitigation, not a
 * primary control), but it must also not remove throttling entirely — so the
 * request is still counted locally.
 */
const degradedStore = new MemoryRateLimitStore();
let lastDegradedLogAt = 0;

function logStoreFailure(error: unknown, requestId: string): void {
  const now = Date.now();
  // Redis outages produce one failure per request; log at most once every 30s.
  if (now - lastDegradedLogAt < 30_000) return;
  lastDegradedLogAt = now;

  console.error("[rate-limit] shared store unavailable, degraded to per-process counters", {
    requestId,
    error: error instanceof Error ? error.message : String(error),
  });
}

function tooManyRequests(resetAt: number): AtlasHttpError {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  const error = new AtlasHttpError({
    // Audit finding L4: this used to report INTERNAL_ERROR, telling clients the
    // server had broken when in fact they should back off and retry.
    code: "RATE_LIMITED",
    status: 429,
    message: `Too many requests. Please try again in ${retryAfterSeconds}s.`,
  });
  return error;
}

export async function enforcePublicRateLimit(args: {
  req: Request;
  bucket: RateLimitBucket;
  requestId: string;
}): Promise<void> {
  const config = BUCKET_LIMITS[args.bucket];
  const key = `${args.bucket}:${resolveClientIp(args.req)}`;

  let hit;
  try {
    hit = await resolveRateLimitStore().hit(key, config.windowMs);
  } catch (error) {
    logStoreFailure(error, args.requestId);
    hit = await degradedStore.hit(key, config.windowMs);
  }

  if (hit.count > config.max) {
    throw tooManyRequests(hit.resetAt);
  }
}

export async function resetRateLimitsForTests(store?: RateLimitStore | null): Promise<void> {
  if (store !== undefined) setRateLimitStore(store);
  await resolveRateLimitStore().reset();
  await degradedStore.reset();
}
