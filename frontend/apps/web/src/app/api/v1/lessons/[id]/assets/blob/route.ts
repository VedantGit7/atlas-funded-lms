import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  ATLAS_INTERNAL_COOKIE_HEADER,
  ATLAS_INTERNAL_TENANT_HOST_HEADER,
} from "@/lib/http-headers";

const API_INTERNAL_URL = process.env["API_INTERNAL_URL"] ?? "http://127.0.0.1:3001";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: lessonId } = await context.params;
  const assetReferenceId = req.headers.get("x-asset-reference-id")?.trim() ?? "";

  if (!assetReferenceId) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "X-Asset-Reference-Id header is required.",
          requestId: randomUUID(),
        },
      },
      { status: 400 },
    );
  }

  if (!req.body) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Uploaded file is empty.",
          requestId: randomUUID(),
        },
      },
      { status: 400 },
    );
  }

  const forwardedHost =
    req.headers.get(ATLAS_INTERNAL_TENANT_HOST_HEADER) ??
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    "";
  const cookie = req.headers.get(ATLAS_INTERNAL_COOKIE_HEADER) ?? req.headers.get("cookie") ?? "";

  const headers = new Headers({
    "content-type": req.headers.get("content-type") ?? "application/octet-stream",
    "x-asset-reference-id": assetReferenceId,
    "idempotency-key":
      req.headers.get("idempotency-key")?.trim() ?? `lesson-asset-blob-proxy-${randomUUID()}`,
    "x-forwarded-host": forwardedHost,
  });

  // Forward content-length so the backend can verify the full body arrived.
  const contentLength = req.headers.get("content-length");
  if (contentLength) {
    headers.set("content-length", contentLength);
  }

  headers.set(ATLAS_INTERNAL_TENANT_HOST_HEADER, forwardedHost);
  if (cookie) {
    headers.set("cookie", cookie);
  }

  // Stream the request body directly instead of buffering the entire file into
  // an ArrayBuffer first. Buffering triggers Next.js's internal body-size limits
  // and causes large audio/video uploads to arrive truncated at the backend,
  // producing the "Upload was interrupted" 400 error.
  // duplex: "half" is required by Node.js undici when the request body is a ReadableStream.
  const fetchOpts: RequestInit & { duplex?: string } = {
    method: "POST",
    headers,
    body: req.body,
    cache: "no-store",
    duplex: "half",
  };
  const response = await fetch(
    `${API_INTERNAL_URL}/api/v1/lessons/${lessonId}/assets/blob`,
    fetchOpts,
  );

  const rawBody = await response.text();
  return new NextResponse(rawBody, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
    },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
