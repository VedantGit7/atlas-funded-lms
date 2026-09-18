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
import { withGlobalDb } from "@atlas/db/global-db";
import type { TenantTx } from "@atlas/db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { ensurePlatformSuperAdminTenantAccess, requireActiveMembership } from "@atlas/membership";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { assertSameOrigin } from "./assert-same-origin";
import { fingerprintRequest, withIdempotency } from "./idempotency-registry";
import { assertTenantMfa } from "@atlas/auth/mfa-enforcement";
import { toSafeErrorEnvelope } from "./error-envelope";
import { loadResourceRefOrDefault } from "./load-resource-ref";
import type { RouteMetadata, TenantRouteContext } from "./route-metadata";
import { noBodySchema } from "./schemas";

type InferParams<TParams extends z.ZodType | undefined> = TParams extends z.ZodType
  ? z.infer<TParams> extends object
    ? z.infer<TParams>
    : Record<string, never>
  : Record<string, never>;

function asParamRecord(params: object): Record<string, string> {
  return params as Record<string, string>;
}

export async function runProtectedTenantRoutePipeline<TInput>(args: {
  tx: TenantTx;
  ctx: TenantRouteContext;
  metadata: RouteMetadata<TInput>;
  params: Record<string, string>;
  input: TInput;
  /**
   * Whether the caller's session has a verified second factor (H5).
   *
   * Threaded explicitly rather than added to `TenantRouteContext`, which is
   * constructed in hundreds of places; an optional flag there would default to
   * "no MFA" at every one of them and quietly deny.
   */
  mfaEnabled?: boolean;
}): Promise<ResourceRef> {
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
    mfaEnabled: args.mfaEnabled ?? false,
    required: args.metadata.mfa === "required",
    permission: args.metadata.permission,
  });

  // Metering runs last, for the same reason MFA runs after the permission
  // decision: a caller who is going to be denied must not consume a unit of the
  // tenant's plan on the way out. Routes that declare no usage function are
  // unaffected — the gate above is the whole of their entitlement handling.
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
  mfaEnabled?: boolean;
  handler: ProtectedTenantRouteHandler<TInput, TOutput, TParams>;
}): Promise<TOutput> {
  const resource = await runProtectedTenantRoutePipeline({
    tx: args.tx,
    ctx: args.ctx,
    metadata: args.metadata,
    params: asParamRecord(args.params),
    input: args.input,
    ...(args.mfaEnabled === undefined ? {} : { mfaEnabled: args.mfaEnabled }),
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
  async function route(req: NextRequest, routeContext?: TenantRouteContextArg) {
    const requestId = getOrCreateRequestId(req.headers);
    const pathname = new URL(req.url).pathname;

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
          const supabaseUser = await requireSupabaseUser(req);

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
          const { tenant, principal } = await withGlobalDb(async (db) => {
            const resolvedTenant = await resolveTenantFromRequest({ req, db });
            const resolvedPrincipal = await upsertAuthPrincipal({
              db,
              supabaseUserId: supabaseUser.supabaseUserId,
              email: supabaseUser.email,
              mfaEnabled: supabaseUser.mfaEnabled,
              markLogin: false,
            });

            await ensurePlatformSuperAdminTenantAccess({
              db,
              tenantId: resolvedTenant.tenantId,
              requestId,
              email: supabaseUser.email,
            });

            return { tenant: resolvedTenant, principal: resolvedPrincipal };
          });

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
          const result = await withTenantTx(
            {
              tenantId: tenant.tenantId,
              requestId,
              allowAnonymousTenantRead: true,
            },
            async (tx) => {
              const membership = await requireActiveMembership({
                tx,
                tenantId: tenant.tenantId,
                authPrincipalId: principal.id,
              });

              const runHandler = () =>
                runProtectedTenantRouteHandler({
                  tx,
                  ctx: {
                    tenantId: tenant.tenantId,
                    requestId,
                    actorMembershipId: membership.membershipId,
                    ...(idempotencyKey ? { idempotencyKey } : {}),
                  },
                  metadata: config.metadata,
                  params,
                  input,
                  mfaEnabled: supabaseUser.mfaEnabled,
                  handler: config.handler,
                });

              // M10. The claim is made in this transaction, so the record and
              // the handler's writes commit together — a handler that throws
              // leaves no claim, and the client's retry is a first attempt
              // rather than a key that is permanently poisoned.
              if (config.metadata.idempotency !== "required" || idempotencyKey === undefined) {
                return runHandler();
              }

              return withIdempotency(
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
            },
          );

          // Phase 4: no connection held while validating and serialising output.
          let body: TOutput;
          try {
            body = config.output.parse(result) as TOutput;
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
        NextResponse.json(safe.body, { status: safe.status }),
        requestId,
      );
    }
  }

  return route;
}
