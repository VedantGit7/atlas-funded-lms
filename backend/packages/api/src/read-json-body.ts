import type { NextRequest } from "next/server";
import type { z } from "zod";
import { AtlasHttpError } from "@atlas/core/http/errors";

/**
 * Reads a route's JSON body and validates it against the route's schema.
 *
 * A request with no body at all is read as `{}`. Action routes such as
 * POST /api/v1/branding/publish declare `noBodySchema` and the web client
 * sends them nothing; `req.json()` threw on that empty body, so every such
 * action failed with a 500 before reaching its handler (November 2026).
 *
 * A body that is not JSON is the client's mistake, so it is a 400 rather than
 * an unexplained server error.
 */
export async function readJsonBody<T>(req: NextRequest, schema: z.ZodType<T>): Promise<T> {
  const text = await req.text();
  if (text.trim() === "") return schema.parse({});

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Request body must be valid JSON.",
    });
  }
  return schema.parse(raw);
}
