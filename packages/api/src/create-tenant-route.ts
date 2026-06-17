import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { can, enforceEntitlement, toAuthorizationError } from "@atlas/authorization";
import type { ResourceRef } from "@atlas/authorization";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import { requireSupabaseUser, upsertAuthPrincipal } from "@atlas/auth";
import { withGlobalDb } from "@atlas/db/global-db";
import type { TenantTx } from "@atlas/db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { requireActiveMembership } from "@atlas/membership";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { toSafeErrorEnvelope } from "./error-envelope";
import { loadResourceRefOrDefault } from "./load-resource-ref";
import type { RouteMetadata, TenantRouteContext } from "./route-metadata";
import { noBodySchema } from "./schemas";

export async function runProtectedTenantRoutePipeline<TInput>(args: {
  tx: TenantTx;
  ctx: TenantRouteContext;
  metadata: RouteMetadata<TInput>;
  params: Record<string, string>;
  input: TInput;
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

  return resource;
}

export type ProtectedTenantRouteHandler<TInput, TOutput> = (args: {
  tx: TenantTx;
  ctx: TenantRouteContext;
  input: TInput;
  resource: ResourceRef;
  params: Record<string, string>;
}) => Promise<TOutput>;

export async function runProtectedTenantRouteHandler<TInput, TOutput>(args: {
  tx: TenantTx;
  ctx: TenantRouteContext;
  metadata: RouteMetadata<TInput>;
  params: Record<string, string>;
  input: TInput;
  handler: ProtectedTenantRouteHandler<TInput, TOutput>;
}): Promise<TOutput> {
  const resource = await runProtectedTenantRoutePipeline({
    tx: args.tx,
    ctx: args.ctx,
    metadata: args.metadata,
    params: args.params,
    input: args.input,
  });

  return args.handler({
    tx: args.tx,
    ctx: args.ctx,
    input: args.input,
    resource,
    params: args.params,
  });
}

function readGetInput(req: NextRequest, schema: z.ZodTypeAny): unknown {
  const url = new URL(req.url);
  const query: Record<string, string> = {};

  for (const [key, value] of url.searchParams.entries()) {
    query[key] = value;
  }

  return schema.parse(query);
}

async function readBodyInput(req: NextRequest, schema: z.ZodTypeAny): Promise<unknown> {
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

type TenantRouteConfig<TInput, TOutput, TParams extends z.ZodTypeAny | undefined = undefined> = {
  metadata: RouteMetadata<TInput>;
  output: z.ZodTypeAny;
  input?: z.ZodTypeAny;
  body?: z.ZodTypeAny;
  params?: TParams;
  handler: ProtectedTenantRouteHandler<TInput, TOutput>;
};

export function createTenantRoute<TInput = Record<string, never>, TOutput = unknown>(
  config: TenantRouteConfig<TInput, TOutput>,
): TenantRouteWithoutParams;

export function createTenantRoute<
  TInput = Record<string, never>,
  TOutput = unknown,
  TParams extends z.ZodTypeAny = z.ZodTypeAny,
>(config: TenantRouteConfig<TInput, TOutput, TParams> & { params: TParams }): TenantRouteWithParams;

export function createTenantRoute<
  TInput = Record<string, never>,
  TOutput = unknown,
  TParams extends z.ZodTypeAny | undefined = undefined,
>(
  config: TenantRouteConfig<TInput, TOutput, TParams>,
): TenantRouteWithParams | TenantRouteWithoutParams {
  async function route(req: NextRequest, routeContext?: TenantRouteContextArg) {
    const requestId = getOrCreateRequestId(req.headers);

    try {
      if (config.metadata.idempotency === "required") {
        requireIdempotencyKey(req);
      }

      return await withGlobalDb(async (db) => {
        const tenant = await resolveTenantFromRequest({ req, db });
        const supabaseUser = await requireSupabaseUser(req);
        const principal = await upsertAuthPrincipal({
          db,
          supabaseUserId: supabaseUser.supabaseUserId,
          email: supabaseUser.email,
          mfaEnabled: supabaseUser.mfaEnabled,
          markLogin: false,
        });

        let input: TInput;

        if (config.body != null) {
          rejectClientSuppliedQueryParams(req);
          input = (await readBodyInput(req, config.body)) as TInput;
        } else if (config.input != null) {
          input = readGetInput(req, config.input) as TInput;
        } else {
          readGetInput(req, noBodySchema);
          input = {} as TInput;
        }

        const params: Record<string, string> =
          config.params != null
            ? (config.params.parse(routeContext ? await routeContext.params : {}) as Record<
                string,
                string
              >)
            : {};

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

            return runProtectedTenantRouteHandler({
              tx,
              ctx: {
                tenantId: tenant.tenantId,
                requestId,
                actorMembershipId: membership.membershipId,
              },
              metadata: config.metadata,
              params,
              input,
              handler: config.handler,
            });
          },
        );

        const body = config.output.parse(result) as TOutput;
        return NextResponse.json(body);
      });
    } catch (error) {
      const safe = toSafeErrorEnvelope(error, requestId);
      return NextResponse.json(safe.body, { status: safe.status });
    }
  }

  return route;
}
