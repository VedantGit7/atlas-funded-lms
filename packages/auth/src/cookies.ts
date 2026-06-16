import type { NextResponse } from "next/server";

export const ATLAS_ACCESS_TOKEN_COOKIE = "atlas_access_token";
export const ATLAS_REFRESH_TOKEN_COOKIE = "atlas_refresh_token";

const isProduction = process.env["NODE_ENV"] === "production";

export function setAuthCookies(args: {
  response: NextResponse;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds?: number;
}): void {
  const maxAge = args.expiresInSeconds ?? 60 * 60;

  args.response.cookies.set(ATLAS_ACCESS_TOKEN_COOKIE, args.accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  args.response.cookies.set(ATLAS_REFRESH_TOKEN_COOKIE, args.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function getBearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}
