import { createHash } from "node:crypto";
import type { RateLimitBucket } from "@atlas/authorization/route-metadata";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { isDeployedRuntime } from "@atlas/core/config/runtime-environment";
import { ATLAS_PROXY_AUTHENTICATED_HEADER } from "@atlas/core/http/api-proxy";
import { resolveClientIp } from "./client-ip";
import {
  RateLimitConfigurationError,
  resolveRateLimitStore,
  setRateLimitStore,
  validateRateLimitConfiguration,
  type RateLimitStore,
} from "./rate-limit-store";

const WINDOW_MS = 60_000;
const PUBLIC_LIMITS: Record<RateLimitBucket, number> = {
  publicRead: 120,
  cspReport: 120,
  publicAuth: 20,
  publicInvitationAccept: 10,
  publicDiagnostic: 10,
  authenticatedTenantRead: 240,
  authenticatedTenantWrite: 60,
};
type Plane = "tenant" | "platform";
type Budget = { key: string; max: number };
let lastFailureLogAt = Number.NEGATIVE_INFINITY;

function identity(parts: string[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

function canonicalBucket(bucket: string, plane: Plane): "read" | "write" {
  if (bucket === "authenticatedTenantRead" || bucket === `${plane}Read`) return "read";
  if (
    bucket === "authenticatedTenantWrite" ||
    bucket === `${plane}Mutation` ||
    (plane === "platform" && bucket === "platformWrite")
  )
    return "write";
  throw new RateLimitConfigurationError("Unknown protected rate-limit bucket.");
}

async function enforceBudgets(budgets: Budget[], requestId: string): Promise<void> {
  // Configuration errors must never be reclassified as recoverable outages.
  const store = resolveRateLimitStore();
  let hits;
  try {
    hits = await Promise.all(
      budgets.map(async (budget) => ({ ...budget, hit: await store.hit(budget.key, WINDOW_MS) })),
    );
    if (
      hits.some(
        ({ hit }) =>
          !Number.isSafeInteger(hit.count) || hit.count < 1 || !Number.isFinite(hit.resetAt),
      )
    )
      throw new Error("Invalid limiter response");
  } catch {
    const now = Date.now();
    if (now - lastFailureLogAt >= 30_000) {
      lastFailureLogAt = now;
      console.error(
        JSON.stringify({
          level: "error",
          event: "rate_limit.store_unavailable",
          requestId,
          store: store.kind,
          policy: "fail_closed",
        }),
      );
    }
    throw new AtlasHttpError({
      code: "SERVICE_UNAVAILABLE",
      status: 503,
      message: "Request protection is temporarily unavailable. Please retry shortly.",
      retryAfterSeconds: 5,
    });
  }
  const exhausted = hits.filter(({ hit, max }) => hit.count > max);
  if (exhausted.length) {
    const retryAfterSeconds = Math.max(
      1,
      ...exhausted.map(({ hit }) => Math.ceil((hit.resetAt - Date.now()) / 1000)),
    );
    throw new AtlasHttpError({
      code: "RATE_LIMITED",
      status: 429,
      message: `Too many requests. Please try again in ${retryAfterSeconds}s.`,
      retryAfterSeconds,
    });
  }
}

/** One cross-route IP budget per plane, before authentication/body/database work. */
export async function enforceIngressRateLimit(args: {
  req: Request;
  plane: Plane;
  requestId: string;
}): Promise<void> {
  validateRateLimitConfiguration();
  const clientIp = resolveClientIp(args.req);
  if (clientIp === "unknown") {
    // Only authenticated server fetches may omit attribution. Browser rewrites
    // are a distinct authenticated source and cannot claim this exception.
    if (
      isDeployedRuntime() &&
      args.req.headers.get(ATLAS_PROXY_AUTHENTICATED_HEADER) !== "server"
    ) {
      throwUnattributedRequest();
    }
    return;
  }
  const operation = ["GET", "HEAD", "OPTIONS"].includes(args.req.method.toUpperCase())
    ? "read"
    : "write";
  await enforceBudgets(
    [
      {
        key: `ingress:${args.plane}:${operation}:${identity([clientIp])}`,
        max: operation === "read" ? 1200 : 300,
      },
    ],
    args.requestId,
  );
}

/** Metadata limit per actor/permission, plus aggregate actor and tenant ceilings. */
export async function enforceProtectedRateLimit(args: {
  plane: Plane;
  tenantId?: string;
  actorId: string;
  permission: string;
  bucket: string;
  requestId: string;
}): Promise<void> {
  const bucket = canonicalBucket(args.bucket, args.plane);
  if (!args.actorId || !args.permission || (args.plane === "tenant" && !args.tenantId))
    throw new RateLimitConfigurationError("Missing authenticated rate-limit identity.");
  const max = bucket === "read" ? 240 : 60;
  const scope = [args.plane, args.tenantId ?? "", args.actorId, bucket];
  const budgets: Budget[] = [
    { key: `${args.plane}:operation:${identity([...scope, args.permission])}`, max },
    { key: `${args.plane}:actor:${identity(scope)}`, max: max * 4 },
  ];
  if (args.plane === "tenant")
    budgets.push({
      key: `tenant:aggregate:${identity([args.tenantId ?? "", bucket])}`,
      max: max * 20,
    });
  await enforceBudgets(budgets, args.requestId);
}

export async function enforcePublicRateLimit(args: {
  req: Request;
  bucket: RateLimitBucket;
  requestId: string;
}): Promise<void> {
  const max = PUBLIC_LIMITS[args.bucket];
  if (!max) throw new RateLimitConfigurationError("Unknown public rate-limit bucket.");
  validateRateLimitConfiguration();
  const clientIp = resolveClientIp(args.req);
  if (clientIp === "unknown" && isDeployedRuntime()) throwUnattributedRequest();
  await enforceBudgets(
    [{ key: `public:${args.bucket}:${identity([clientIp])}`, max }],
    args.requestId,
  );
}

function throwUnattributedRequest(): never {
  throw new AtlasHttpError({
    code: "SERVICE_UNAVAILABLE",
    status: 503,
    message: "Request protection is temporarily unavailable. Please retry shortly.",
    retryAfterSeconds: 5,
  });
}

export async function resetRateLimitsForTests(store?: RateLimitStore | null): Promise<void> {
  if (store !== undefined) setRateLimitStore(store);
  await resolveRateLimitStore().reset();
  lastFailureLogAt = Number.NEGATIVE_INFINITY;
}
