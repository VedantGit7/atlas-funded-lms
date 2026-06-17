import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { can, enforceEntitlement, toAuthorizationError } from "@atlas/authorization";
import type { ResourceRef } from "@atlas/authorization";
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

function readGetInput<T>(req: NextRequest, schema: z.ZodType<T>): T {
  const url = new URL(req.url);
  const query: Record<string, string> = {};

  for (const [key, value] of url.searchParams.entries()) {
    query[key] = value;
  }

  return schema.parse(query);
}

export function createTenantRoute<TInput, TOutput>(config: {
  metadata: RouteMetadata<TInput>;
  input: z.ZodType<TInput>;
  output: z.ZodType<TOutput>;
  handler: ProtectedTenantRouteHandler<TInput, TOutput>;
}) {
  return async function route(req: NextRequest) {
    const requestId = getOrCreateRequestId(req.headers);

    try {
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

        const input = readGetInput(req, config.input);

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
              params: {},
              input,
              handler: config.handler,
            });
          },
        );

        const body = config.output.parse(result);
        return NextResponse.json(body);
      });
    } catch (error) {
      const safe = toSafeErrorEnvelope(error, requestId);
      return NextResponse.json(safe.body, { status: safe.status });
    }
  };
}
