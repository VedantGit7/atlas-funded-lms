import { NextResponse } from "next/server";
import { z } from "zod";
import { createPublicRouteHandler } from "@atlas/api";
import { applyAuthSessionToCookieStore, readSessionPersistence } from "@atlas/auth/cookie-store";
import { refreshSessionFromRefreshToken } from "@atlas/auth";
import { authRequired } from "@atlas/auth";
import { extractRefreshToken } from "@atlas/auth/session";
import { routeMetadata } from "./route.metadata";

const refreshResponseSchema = z.object({
  data: z.object({
    refreshed: z.literal(true),
  }),
});

export const POST = createPublicRouteHandler(routeMetadata, async ({ req }) => {
  const refreshToken = await extractRefreshToken(req);

  if (!refreshToken) {
    throw authRequired();
  }

  const session = await refreshSessionFromRefreshToken({ refreshToken });

  await applyAuthSessionToCookieStore({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresInSeconds: session.expiresIn,
    persistent: await readSessionPersistence(req),
  });

  const body = refreshResponseSchema.parse({
    data: {
      refreshed: true,
    },
  });

  return NextResponse.json(body);
});
