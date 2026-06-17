import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { requirePlatformPrincipal } from "@atlas/auth/platform-auth";
import { ATLAS_PLATFORM_REASON_HEADER } from "@atlas/core/http/headers";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import { withGlobalDb } from "@atlas/db/global-db";
import {
  withPlatformScope,
  PlatformScopeError,
  type PlatformPermission,
  type PlatformTx,
} from "@atlas/db";
import { toSafeErrorEnvelope } from "./error-envelope";
import type { PlatformRouteContext, PlatformRouteMetadata } from "./route-metadata";

const MIN_PLATFORM_REASON_LENGTH = 10;

function readQueryInput<T>(req: NextRequest, schema: z.ZodType<T>): T {
  const url = new URL(req.url);
  const query: Record<string, string> = {};

  for (const [key, value] of url.searchParams.entries()) {
    query[key] = value;
  }

  return schema.parse(query);
}

async function readBodyInput<T>(req: NextRequest, schema: z.ZodType<T>): Promise<T> {
  const raw: unknown = await req.json();
  return schema.parse(raw);
}

function readPlatformReason(req: NextRequest): string {
  const reason = req.headers.get(ATLAS_PLATFORM_REASON_HEADER)?.trim() ?? "";

  if (reason.length < MIN_PLATFORM_REASON_LENGTH) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Platform reason is required.",
    });
  }

  return reason;
}

function readIdempotencyKey(req: NextRequest): string {
  const idempotencyKey = req.headers.get("idempotency-key")?.trim() ?? "";

  if (!idempotencyKey) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Idempotency-Key header is required.",
    });
  }

  return idempotencyKey;
}

export type PlatformRouteHandler<TQuery, TParams, TBody, TOutput> = (args: {
  tx: PlatformTx;
  ctx: PlatformRouteContext;
  query: TQuery;
  params: TParams;
  body: TBody;
}) => Promise<TOutput>;

type PlatformRouteContextArg = {
  params: Promise<Record<string, string>>;
};

type PlatformRouteWithParams = (
  req: NextRequest,
  routeContext: PlatformRouteContextArg,
) => Promise<NextResponse>;

type PlatformRouteWithoutParams = (req: NextRequest) => Promise<NextResponse>;

type InferParams<TParams extends z.ZodTypeAny | undefined> = TParams extends z.ZodTypeAny
  ? z.infer<TParams>
  : Record<string, never>;

export function createPlatformRoute<
  TQuery = Record<string, never>,
  TParams extends z.ZodTypeAny | undefined = undefined,
  TBody = Record<string, never>,
  TOutput = unknown,
>(config: {
  metadata: PlatformRouteMetadata;
  query?: z.ZodType<TQuery>;
  params?: TParams;
  body?: z.ZodType<TBody>;
  output: z.ZodType<TOutput>;
  handler: PlatformRouteHandler<
    TQuery,
    TParams extends z.ZodTypeAny ? z.infer<TParams> : Record<string, never>,
    TBody,
    TOutput
  >;
}): TParams extends z.ZodTypeAny ? PlatformRouteWithParams : PlatformRouteWithoutParams {
  async function route(req: NextRequest, routeContext?: PlatformRouteContextArg) {
    const requestId = getOrCreateRequestId(req.headers);

    try {
      if (!config.metadata.permission.startsWith("platform.")) {
        throw new Error("Platform route must declare a platform.* permission");
      }

      return await withGlobalDb(async (db) => {
        const platformPrincipal = await requirePlatformPrincipal({
          req,
          db,
          requiredPermission: config.metadata.permission,
        });

        const reason =
          config.metadata.reasonRequired === true
            ? readPlatformReason(req)
            : (req.headers.get(ATLAS_PLATFORM_REASON_HEADER)?.trim() ?? "platform.route");

        const idempotencyKey =
          config.metadata.idempotency === "required"
            ? readIdempotencyKey(req)
            : (req.headers.get("idempotency-key")?.trim() ?? "");

        const query = config.query != null ? readQueryInput(req, config.query) : ({} as TQuery);
        const params: InferParams<TParams> =
          config.params != null
            ? (config.params.parse(
                routeContext ? await routeContext.params : {},
              ) as InferParams<TParams>)
            : ({} as InferParams<TParams>);
        const body = config.body != null ? await readBodyInput(req, config.body) : ({} as TBody);

        const ctx: PlatformRouteContext = {
          platformPrincipalId: platformPrincipal.platformPrincipalId,
          requestId,
          reason,
          idempotencyKey,
        };

        const result = await withPlatformScope(
          {
            principalId: platformPrincipal.platformPrincipalId,
            requestId,
            requiredPermission: config.metadata.permission as PlatformPermission,
            platformPermissions:
              platformPrincipal.platformPermissions as readonly PlatformPermission[],
            route: new URL(req.url).pathname,
          },
          reason,
          async (tx) =>
            config.handler({
              tx,
              ctx,
              query,
              params,
              body,
            }),
        );

        const bodyOut = config.output.parse(result);
        return NextResponse.json(bodyOut);
      });
    } catch (error) {
      if (error instanceof PlatformScopeError) {
        const atlasError = new AtlasHttpError({
          code: error.message.toLowerCase().includes("permission")
            ? "PERMISSION_DENIED"
            : "VALIDATION_ERROR",
          status: error.message.toLowerCase().includes("permission") ? 403 : 400,
          message: error.message,
        });
        const safe = toSafeErrorEnvelope(atlasError, requestId);
        return NextResponse.json(safe.body, { status: safe.status });
      }

      const safe = toSafeErrorEnvelope(error, requestId);
      return NextResponse.json(safe.body, { status: safe.status });
    }
  }

  return route;
}
