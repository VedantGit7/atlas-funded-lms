import { Readable } from "node:stream";
import { createPublicRouteHandler } from "@atlas/api";
import { AtlasHttpError } from "@atlas/core/http/errors";
import {
  LocalFilesystemStorageProvider,
  contentDispositionFor,
  parseStorageEnv,
} from "@atlas/storage";
import { createStorageProvider } from "@atlas/storage/providers/storage-provider-factory";
import { NextResponse } from "next/server";
import { z } from "zod";
import { routeMetadata } from "./route.metadata";

const downloadQuerySchema = z.object({
  bucket: z.string().min(1),
  key: z.string().min(1),
  expires: z.coerce.number().int().positive(),
  token: z.string().min(1),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createPublicRouteHandler(routeMetadata, async ({ req }) => {
  const env = parseStorageEnv(process.env);
  if (env.STORAGE_PROVIDER !== "local-fs") {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Local storage downloads are not enabled.",
    });
  }

  const url = new URL(req.url);
  const query = downloadQuerySchema.parse({
    bucket: url.searchParams.get("bucket"),
    key: url.searchParams.get("key"),
    expires: url.searchParams.get("expires"),
    token: url.searchParams.get("token"),
  });

  const provider = createStorageProvider(env);
  if (!(provider instanceof LocalFilesystemStorageProvider)) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Local storage downloads are not enabled.",
    });
  }

  const valid = provider.verifyDownloadToken({
    bucket: query.bucket,
    key: query.key,
    expiresAtMs: query.expires,
    token: query.token,
  });

  if (!valid) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 403,
      message: "Download link is invalid or expired.",
    });
  }

  const location = { bucket: query.bucket, key: query.key };
  const meta = await provider.headObject(location);
  const body = meta ? await provider.getObjectStream({ ...location, signal: req.signal }) : null;
  if (!meta || !body) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "File is no longer available.",
    });
  }

  // Audit M8: this route serves uploaded bytes from the app's own origin, the
  // one holding session cookies. Never let a browser sniff a different type,
  // download anything that must not render inline, and render whatever does
  // in an opaque origin with nothing allowed to load or run.
  const fileName = query.key.split("/").pop() ?? "download";
  const disposition = meta.contentDisposition ?? contentDispositionFor(meta.contentType, fileName);
  const isPdf = meta.contentType.toLowerCase().startsWith("application/pdf");
  return new NextResponse(Readable.toWeb(body) as ReadableStream<Uint8Array>, {
    status: 200,
    headers: {
      "content-type": meta.contentType,
      "content-length": String(meta.sizeBytes),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      ...(disposition ? { "content-disposition": disposition } : {}),
      // The browser PDF viewer cannot run in a sandboxed document.
      ...(isPdf ? {} : { "content-security-policy": "default-src 'none'; sandbox" }),
    },
  });
});
