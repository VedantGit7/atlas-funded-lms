import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { toSafeErrorEnvelope } from "@atlas/api";
import { enforceIngressRateLimit, enforcePublicRateLimit } from "@atlas/api/rate-limit";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { attachRequestIdHeader, runRouteLifecycle } from "@atlas/observability";
import { getStorageProvider } from "@atlas/storage/providers/storage-provider-factory";
import { scormContentSecurityHeaders } from "@atlas/storage/scorm-content-headers";
import {
  assertSafeRelativePath,
  buildScormContentStorageKey,
  scormContentTypeFor,
} from "@atlas/storage/scorm-package-extract";
import { parseStorageEnv } from "@atlas/storage/schemas/storage-env";
import { verifyScormContentCapability } from "../../../../../../../server/courses/scorm-content-capability";
import { isSameOriginSubresourceRequest } from "../../../../../../../server/courses/scorm-fetch-metadata";
import {
  authorizeScormContentRequest,
  loadScormRuntimeConfig,
  scormContentNotFound,
} from "../../../../../../../server/courses/scorm-content.service";
import {
  buildScormRuntimeScript,
  injectScormRuntimeTag,
  isScormHtml,
  SCORM_RUNTIME_FILE,
} from "../../../../../../../server/courses/scorm-runtime";
import { routeMetadata } from "./route.metadata";

/**
 * SCORM package files, beneath a signed package-read capability.
 *
 * `/api/v1/public/scorm/<capability>/<path inside the package>`: putting the
 * capability in the path is what lets a package's relative references resolve
 * to sibling files and still carry it, from inside an opaque sandboxed origin
 * that sends no cookies.
 *
 * Phases, so no pooled connection is held across network I/O: verify the
 * capability (no I/O) → one short tenant transaction to re-authorize (and, for
 * the runtime file, read saved progress) → release it → read storage.
 */
const ROUTE = "/api/v1/public/scorm/[token]/[...path]";

type RouteContext = { params: Promise<{ token: string; path: string[] }> };

/** A single `bytes=` range; anything else is served whole, as RFC 9110 permits. */
function parseRange(
  header: string | null,
  size: number,
): { start: number; end: number } | null | "unsatisfiable" {
  const match = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null;
  if (!match || (match[1] === "" && match[2] === "")) return null;
  let start: number;
  let end: number;
  if (match[1] === "") {
    const suffix = Number(match[2]);
    if (suffix === 0) return "unsatisfiable";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return null;
  if (start >= size || start > end) return "unsatisfiable";
  return { start, end };
}

function contentHeaders(contentType: string, cache: string): Record<string, string> {
  return {
    "content-type": contentType,
    "cache-control": cache,
    ...scormContentSecurityHeaders(),
  };
}

async function serve(
  req: NextRequest,
  context: RouteContext,
  requestId: string,
): Promise<NextResponse> {
  await enforceIngressRateLimit({ req, plane: "tenant", requestId });
  if (isSameOriginSubresourceRequest(req.headers)) throw scormContentNotFound();

  const { token, path } = await context.params;
  const capability = verifyScormContentCapability(token);
  if (!capability) throw scormContentNotFound();
  await enforcePublicRateLimit({
    req,
    bucket: routeMetadata.rateLimit,
    requestId,
    subject: capability.launchId,
  });

  let relativePath: string;
  try {
    relativePath = assertSafeRelativePath(path.join("/"));
  } catch {
    throw scormContentNotFound();
  }

  const isRuntime = relativePath === SCORM_RUNTIME_FILE;
  const runtimeConfig = await withTenantTx(
    { tenantId: capability.tenantId, actorMembershipId: capability.membershipId, requestId },
    async (tx) => {
      await authorizeScormContentRequest(tx, capability, requestId);
      return isRuntime ? await loadScormRuntimeConfig(tx, capability) : null;
    },
  );

  if (runtimeConfig) {
    // Carries this learner's saved data: never cache it.
    return new NextResponse(buildScormRuntimeScript(runtimeConfig), {
      status: 200,
      headers: contentHeaders("text/javascript; charset=utf-8", "private, no-store"),
    });
  }

  const env = parseStorageEnv(process.env);
  const provider = getStorageProvider();
  const key = buildScormContentStorageKey({
    tenantId: capability.tenantId,
    moduleId: capability.moduleId,
    relativePath,
    contentVersion: capability.contentVersion,
  });
  const contentType = scormContentTypeFor(relativePath);

  if (isScormHtml(contentType)) {
    const html = await provider.getObjectBody({ bucket: env.R2_BUCKET_NAME, key });
    if (!html) throw scormContentNotFound();
    const runtimeUrl = `/api/v1/public/scorm/${encodeURIComponent(token)}/${SCORM_RUNTIME_FILE}`;
    return new NextResponse(new Uint8Array(injectScormRuntimeTag(html, runtimeUrl)), {
      status: 200,
      headers: contentHeaders(contentType, "private, no-store"),
    });
  }

  // Package files are immutable per content version, and the capability is per
  // launch, so the browser may keep them for the session.
  const cache = "private, max-age=3600";
  // Streams end when the learner navigates away; the cap only bounds a stalled client.
  // (The providers' 30 s default would cut off a large video on a slow connection.)
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(10 * 60_000)]);
  const rangeHeader = req.headers.get("range");
  if (rangeHeader && provider.getObjectStream) {
    const metadata = await provider.headObject({ bucket: env.R2_BUCKET_NAME, key });
    if (!metadata) throw scormContentNotFound();
    const range = parseRange(rangeHeader, metadata.sizeBytes);
    if (range === "unsatisfiable") {
      return new NextResponse(null, {
        status: 416,
        headers: {
          "content-range": `bytes */${String(metadata.sizeBytes)}`,
          ...scormContentSecurityHeaders(),
        },
      });
    }
    if (range) {
      const stream = await provider.getObjectStream({
        bucket: env.R2_BUCKET_NAME,
        key,
        range,
        signal,
      });
      if (!stream) throw scormContentNotFound();
      return new NextResponse(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
        status: 206,
        headers: {
          ...contentHeaders(contentType, cache),
          "accept-ranges": "bytes",
          "content-range": `bytes ${String(range.start)}-${String(range.end)}/${String(metadata.sizeBytes)}`,
          "content-length": String(range.end - range.start + 1),
        },
      });
    }
  }

  if (provider.getObjectStream) {
    const stream = await provider.getObjectStream({ bucket: env.R2_BUCKET_NAME, key, signal });
    if (!stream) throw scormContentNotFound();
    return new NextResponse(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      status: 200,
      headers: { ...contentHeaders(contentType, cache), "accept-ranges": "bytes" },
    });
  }
  const body = await provider.getObjectBody({ bucket: env.R2_BUCKET_NAME, key });
  if (!body) throw scormContentNotFound();
  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: contentHeaders(contentType, cache),
  });
}

export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(req.headers);
  try {
    // A fixed route name: the path itself is a credential and must never be logged.
    return await runRouteLifecycle(
      {
        requestId,
        route: ROUTE,
        routeGroup: "public",
        actorPlane: "public",
        classifyError: (error) => toSafeErrorEnvelope(error, requestId).body.error.code,
      },
      async () => attachRequestIdHeader(await serve(req, context, requestId), requestId),
    );
  } catch (error) {
    const safe = toSafeErrorEnvelope(error, requestId);
    return attachRequestIdHeader(
      NextResponse.json(safe.body, {
        status: safe.status,
        headers: {
          ...(safe.headers ?? {}),
          "cache-control": "no-store",
          "referrer-policy": "no-referrer",
        },
      }),
      requestId,
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
