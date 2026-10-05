import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ZodError, type z } from "zod";
import {
  can,
  consumeEntitlementUnits,
  enforceEntitlement,
  toAuthorizationError,
} from "@atlas/authorization";
import type { ResourceRef } from "@atlas/authorization";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import { attachRequestIdHeader, inferRouteGroup, runRouteLifecycle } from "@atlas/observability";
import { requireSupabaseUser, upsertAuthPrincipal } from "@atlas/auth";
import type { SessionAssuranceLevel } from "@atlas/auth";
import { withGlobalDb } from "@atlas/db/global-db";
import type { TenantTx } from "@atlas/db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { requireActiveMembership } from "@atlas/membership";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { assertSameOrigin } from "./assert-same-origin";
import {
  fingerprintRequest,
  validateIdempotencyKey,
  withIdempotency,
} from "./idempotency-registry";
import { assertTenantMfa } from "@atlas/auth/mfa-enforcement";
import { toSafeErrorEnvelope } from "./error-envelope";
import { loadResourceRefOrDefault } from "./load-resource-ref";
import type { RouteMetadata, TenantRouteContext } from "./route-metadata";
import { noBodySchema } from "./schemas";
import { createTenantRequestUsage } from "./tenant-usage-meter";
import { enforceIngressRateLimit, enforceProtectedRateLimit } from "./rate-limit";
import { measureRouteStage } from "./route-stage-timings";
import { ensureMutationAudited } from "./mutation-audit";

type InferParams<TParams extends z.ZodType | undefined> = TParams extends z.ZodType
  ? z.infer<TParams> extends object
    ? z.infer<TParams>
    : Record<string, never>
  : Record<string, never>;

function asParamRecord(params: object): Record<string, string> {
  return params as Record<string, string>;
}

async function authorizeProtectedTenantRoute<TInput>(args: {
  tx: TenantTx;
  ctx: TenantRouteContext;
  metadata: RouteMetadata<TInput>;
  params: Record<string, string>;
  input: TInput;
  /**
   * Verified assurance on the current access token, separate from enrollment.
   * Missing assurance fails closed on routes requiring MFA.
   */
  sessionAssuranceLevel?: SessionAssuranceLevel | undefined;
}): Promise<ResourceRef> {
  await enforceProtectedRateLimit({
    plane: "tenant",
    tenantId: args.ctx.tenantId,
    actorId: args.ctx.actorMembershipId,
    permission: args.metadata.permission,
    bucket: args.metadata.rateLimit,
    requestId: args.ctx.requestId,
  });
  await enforceEntitlement(args.tx, {
    tenantId: args.ctx.tenantId,
    key: args.metadata.entitlement ?? null,
    requestId: args.ctx.requestId,
  });

  const resource = await loadResourceRefOrDefault({
    tx: args.tx,
    metadata: args.metadata,
    ctx: args.ctx,
    params: args.params,
    input: args.input,
  });

  const decision = await can({
    tx: args.tx,
    actor: {
      tenantId: args.ctx.tenantId,
      membershipId: args.ctx.actorMembershipId,
    },
    permission: args.metadata.permission,
    resource,
    ctx: {
      tenantId: args.ctx.tenantId,
      requestId: args.ctx.requestId,
    },
  });

  if (!decision.allowed) {
    throw toAuthorizationError(decision);
  }

  // After the permission decision on purpose: a caller who lacks the permission
  // should learn "denied", not "you need MFA" — the latter tells them the
  // action exists and that they would otherwise be allowed to perform it.
  assertTenantMfa({
    sessionAssuranceLevel: args.sessionAssuranceLevel,
    required: args.metadata.mfa === "required",
    permission: args.metadata.permission,
  });

  return resource;
}

async function consumeProtectedTenantRouteUsage<TInput>(args: {
  tx: TenantTx;
  ctx: TenantRouteContext;
  metadata: RouteMetadata<TInput>;
  params: Record<string, string>;
  input: TInput;
}): Promise<void> {
  // This is a mutation: charge only the claimed operation, never a replay.
  if (args.metadata.entitlementUsage) {
    await consumeEntitlementUnits(args.tx, {
      tenantId: args.ctx.tenantId,
      key: args.metadata.entitlement ?? null,
      requestId: args.ctx.requestId,
      units: args.metadata.entitlementUsage({
        ctx: args.ctx,
        params: args.params,
        input: args.input,
      }),
    });
  }
}

/** Non-replay callers retain the complete authorization-and-metering pipeline. */
export async function runProtectedTenantRoutePipeline<TInput>(
  args: Parameters<typeof authorizeProtectedTenantRoute<TInput>>[0],
): Promise<ResourceRef> {
  const resource = await authorizeProtectedTenantRoute(args);
  await consumeProtectedTenantRouteUsage(args);
  return resource;
}

export type ProtectedTenantRouteHandler<TInput, TOutput, TParams = Record<string, never>> = (args: {
  tx: TenantTx;
  ctx: TenantRouteContext;
  input: TInput;
  resource: ResourceRef;
  params: TParams;
}) => Promise<TOutput>;

export async function runProtectedTenantRouteHandler<
  TInput,
  TOutput,
  TParams extends object = Record<string, never>,
>(args: {
  tx: TenantTx;
  ctx: TenantRouteContext;
  metadata: RouteMetadata<TInput>;
  params: TParams;
  input: TInput;
  sessionAssuranceLevel?: SessionAssuranceLevel | undefined;
  handler: ProtectedTenantRouteHandler<TInput, TOutput, TParams>;
}): Promise<TOutput> {
  const resource = await runProtectedTenantRoutePipeline({
    tx: args.tx,
    ctx: args.ctx,
    metadata: args.metadata,
    params: asParamRecord(args.params),
    input: args.input,
    sessionAssuranceLevel: args.sessionAssuranceLevel,
  });

  return args.handler({
    tx: args.tx,
    ctx: args.ctx,
    input: args.input,
    resource,
    params: args.params,
  });
}

function readGetInput(req: NextRequest, schema: z.ZodType): unknown {
  const url = new URL(req.url);
  const query: Record<string, string> = {};

  for (const [key, value] of url.searchParams.entries()) {
    query[key] = value;
  }

  return schema.parse(query);
}

async function readBodyInput(req: NextRequest, schema: z.ZodType): Promise<unknown> {
  const raw: unknown = await req.json();
  return schema.parse(raw);
}

function requireIdempotencyKey(req: NextRequest): void {
  const idempotencyKey = req.headers.get("idempotency-key")?.trim() ?? "";

  if (!idempotencyKey) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Idempotency-Key header is required.",
    });
  }
  validateIdempotencyKey(idempotencyKey);
}

function rejectClientSuppliedQueryParams(req: NextRequest): void {
  readGetInput(req, noBodySchema);
}

type TenantRouteContextArg = {
  params: Promise<Record<string, string>>;
};

type TenantRouteWithParams = (
  req: NextRequest,
  routeContext: TenantRouteContextArg,
) => Promise<NextResponse>;

type TenantRouteWithoutParams = (req: NextRequest) => Promise<NextResponse>;

type TenantRouteConfig<TInput, TOutput, TParams extends z.ZodType | undefined = undefined> = {
  metadata: RouteMetadata<TInput>;
  output: z.ZodType;
  input?: z.ZodType;
  body?: z.ZodType;
  readBody?: (req: NextRequest) => Promise<unknown>;
  params?: TParams;
  handler: ProtectedTenantRouteHandler<TInput, TOutput, InferParams<TParams>>;
  /**
   * Work that must not run inside the request transaction: object storage,
   * outbound HTTP, heavy CPU (audit H3). Runs after the handler's transaction
   * commits, holding no pooled connection; it may open its own short
   * transaction. Its return value is the response body. The handler's writes
   * are already committed when it runs, so a failure here must leave a state
   * the next request can recover from.
   *
   * On an idempotent route a replay returns the stored handler result and runs
   * this step again, so it must be idempotent itself; the route says so with
   * `afterCommitIsIdempotent: true`.
   */
  afterCommit?: (args: {
    result: TOutput;
    ctx: TenantRouteContext;
    params: InferParams<TParams>;
  }) => Promise<unknown>;
  /** Required with afterCommit on an idempotent route; see afterCommit. */
  afterCommitIsIdempotent?: boolean;
};

export function createTenantRoute<TInput = Record<string, never>, TOutput = unknown>(
  config: TenantRouteConfig<TInput, TOutput>,
): TenantRouteWithoutParams;

export function createTenantRoute<
  TInput = Record<string, never>,
  TOutput = unknown,
  TParams extends z.ZodType = z.ZodType,
>(config: TenantRouteConfig<TInput, TOutput, TParams> & { params: TParams }): TenantRouteWithParams;

export function createTenantRoute<
  TInput = Record<string, never>,
  TOutput = unknown,
  TParams extends z.ZodType | undefined = undefined,
>(
  config: TenantRouteConfig<TInput, TOutput, TParams>,
): TenantRouteWithParams | TenantRouteWithoutParams {
  if (
    config.afterCommit &&
    config.metadata.idempotency === "required" &&
    config.afterCommitIsIdempotent !== true
  ) {
    throw new Error(
      'afterCommit on an idempotency: "required" route reruns on every replay; it must be idempotent and declare afterCommitIsIdempotent: true',
    );
  }

  async function route(req: NextRequest, routeContext?: TenantRouteContextArg) {
    const requestId = getOrCreateRequestId(req.headers);
    const pathname = new URL(req.url).pathname;
    // Cost attribution (DoD item 8). Set once the tenant is known, so a request
    // that fails authentication before tenant resolution -- which cannot be
    // attributed to anyone -- is not counted.
    const startedAt = performance.now();
    // A holder rather than a `let`: the tenant is assigned inside the lifecycle
    // callback, which control-flow analysis cannot see from the `finally`.
    const metered: { usage?: ReturnType<typeof createTenantRequestUsage> } = {};

    try {
      return await runRouteLifecycle(
        {
          requestId,
          route: pathname,
          routeGroup: inferRouteGroup(pathname),
          actorPlane: "tenant",
          // Log the code this route will actually answer with, derived from the
          // same envelope the catch below responds with, so the two cannot drift.
          classifyError: (error) => toSafeErrorEnvelope(error, requestId).body.error.code,
        },
        async () => {
          await enforceIngressRateLimit({ req, plane: "tenant", requestId });
          if (config.metadata.idempotency === "required") {
            requireIdempotencyKey(req);
          }

          // ---------------------------------------------------------------
          // Phase 1: no database connection held.
          //
          // requireSupabaseUser makes up to three Supabase HTTPS calls. It used
          // to run inside withGlobalDb, pinning a pooled connection for the
          // duration of that network I/O. Input parsing is pure CPU and likewise
          // needs no connection.
          //
          // Note this moves authentication ahead of tenant resolution, so an
          // unauthenticated request to an unknown host now fails 401 rather than
          // tenant-unavailable. That ordering is preferable anyway: it does not
          // disclose whether a tenant host exists to an anonymous caller.
          // ---------------------------------------------------------------
          const supabaseUser = await measureRouteStage("authentication", () =>
            requireSupabaseUser(req),
          );

          let input: TInput;

          if (config.readBody != null) {
            rejectClientSuppliedQueryParams(req);
            input = (await config.readBody(req)) as TInput;
          } else if (config.body != null) {
            rejectClientSuppliedQueryParams(req);
            input = (await readBodyInput(req, config.body)) as TInput;
          } else if (config.input != null) {
            input = readGetInput(req, config.input) as TInput;
          } else {
            readGetInput(req, noBodySchema);
            input = {} as TInput;
          }

          const params: InferParams<TParams> =
            config.params != null
              ? (config.params.parse(
                  routeContext ? await routeContext.params : {},
                ) as InferParams<TParams>)
              : ({} as InferParams<TParams>);

          const idempotencyKey = req.headers.get("idempotency-key")?.trim() ?? undefined;
          // The context the handler ran with, for afterCommit. A holder for the
          // same reason as `metered`: it is assigned inside a callback.
          const committed: { ctx?: TenantRouteContext } = {};

          // ---------------------------------------------------------------
          // Phase 2: first connection, released before phase 3 begins.
          //
          // withTenantTx used to be nested INSIDE this block, so every request
          // held two pool connections at once. With DATABASE_POOL_MAX = 20 that
          // deadlocked at 20 concurrent requests: each held an outer connection
          // while waiting for an inner one, none could release, and every
          // request failed after the 10s connect timeout. Measured 0 successful
          // requests at 20 concurrent; 364 rps at 80 concurrent once un-nested.
          // ---------------------------------------------------------------
          const { tenant, principal } = await measureRouteStage("global_total", () =>
            withGlobalDb((db) =>
              measureRouteStage("global_work", async () => {
                const resolvedTenant = await resolveTenantFromRequest({ req, db });
                const resolvedPrincipal = await upsertAuthPrincipal({
                  db,
                  supabaseUserId: supabaseUser.supabaseUserId,
                  email: supabaseUser.email,
                  emailConfirmed: supabaseUser.emailConfirmed,
                  mfaEnabled: supabaseUser.mfaEnabled,
                  markLogin: false,
                });

                return { tenant: resolvedTenant, principal: resolvedPrincipal };
              }),
            ),
          );
          const usage = createTenantRequestUsage(tenant.tenantId);
          metered.usage = usage;

          // Cross-tenant CSRF guard. Runs after tenant resolution because it
          // needs the resolved host to compare against. See assert-same-origin.ts
          // for why SameSite=Lax does not separate tenants on a shared base domain.
          assertSameOrigin({
            method: req.method,
            origin: req.headers.get("origin"),
            host: tenant.host,
          });

          // Phase 3: second connection, acquired only after the first is back
          // in the pool.
          const result = await measureRouteStage("tenant_total", () =>
            withTenantTx(
              {
                tenantId: tenant.tenantId,
                requestId,
                allowAnonymousTenantRead: true,
              },
              (tx) =>
                measureRouteStage("tenant_work", async () => {
                  const membership = await requireActiveMembership({
                    tx,
                    tenantId: tenant.tenantId,
                    authPrincipalId: principal.id,
                  });

                  const pipelineArgs = {
                    tx,
                    ctx: {
                      tenantId: tenant.tenantId,
                      requestId,
                      actorMembershipId: membership.membershipId,
                      ...(idempotencyKey ? { idempotencyKey } : {}),
                    },
                    metadata: config.metadata,
                    params: asParamRecord(params),
                    input,
                    sessionAssuranceLevel: supabaseUser.sessionAssuranceLevel,
                  };
                  // F03: every request, including a replay, uses current resource,
                  // permission, entitlement, and session-MFA evidence.
                  const resource = await authorizeProtectedTenantRoute(pipelineArgs);
                  committed.ctx = pipelineArgs.ctx;
                  const runHandler = async () => {
                    await consumeProtectedTenantRouteUsage(pipelineArgs);
                    const output = await config.handler({
                      tx,
                      ctx: pipelineArgs.ctx,
                      input,
                      resource,
                      params,
                    });
                    // M7: a mutation declaring audit: "required" is on the record.
                    await ensureMutationAudited(tx, {
                      ctx: pipelineArgs.ctx,
                      metadata: config.metadata,
                      method: req.method,
                      route: pathname,
                      resource,
                    });
                    return output;
                  };

                  // M10. The claim is made in this transaction, so the record and
                  // the handler's writes commit together — a handler that throws
                  // leaves no claim, and the client's retry is a first attempt
                  // rather than a key that is permanently poisoned.
                  const outcome =
                    config.metadata.idempotency !== "required" || idempotencyKey === undefined
                      ? await runHandler()
                      : await withIdempotency(
                          tx,
                          {
                            tenantId: tenant.tenantId,
                            idempotencyKey,
                            scope: `${req.method} ${pathname}`,
                            requestFingerprint: fingerprintRequest({
                              method: req.method,
                              path: pathname,
                              body: input,
                            }),
                            actorMembershipId: membership.membershipId,
                            requestId,
                          },
                          runHandler,
                        );
                  // A successful operation and its operational request count
                  // commit atomically. Replays count as requests too, without
                  // charging entitlement units or executing business work twice.
                  await measureRouteStage("usage", () =>
                    usage.append(tx, {
                      requests: 1,
                      durationMs: performance.now() - startedAt,
                    }),
                  );
                  return outcome;
                }),
            ),
          );
          usage.committed();
          delete metered.usage;

          // Phase 4: no connection held while validating and serialising output.
          let responseValue: unknown = result;
          const afterCommit = config.afterCommit;
          const handlerCtx = committed.ctx;
          if (afterCommit && handlerCtx) {
            responseValue = await measureRouteStage("after_commit", () =>
              afterCommit({ result, ctx: handlerCtx, params }),
            );
          }
          let body: TOutput;
          try {
            body = config.output.parse(responseValue) as TOutput;
          } catch (error) {
            if (error instanceof ZodError) {
              throw new AtlasHttpError({
                code: "INTERNAL_ERROR",
                status: 500,
                message: "Response validation failed",
                expose: false,
              });
            }
            throw error;
          }
          return attachRequestIdHeader(NextResponse.json(body), requestId);
        },
      );
    } catch (error) {
      const safe = toSafeErrorEnvelope(error, requestId);
      return attachRequestIdHeader(
        NextResponse.json(safe.body, { status: safe.status, headers: safe.headers ?? {} }),
        requestId,
      );
    } finally {
      // Failed requests are counted too: a denied or invalid request still
      // spent server time resolving the tenant and checking permissions.
      const usage = metered.usage;
      if (usage) {
        await measureRouteStage("usage", () =>
          usage.fallback({
            requests: 1,
            durationMs: performance.now() - startedAt,
          }),
        );
      }
    }
  }

  return route;
}
