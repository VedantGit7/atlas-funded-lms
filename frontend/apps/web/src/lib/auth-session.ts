import { cookies } from "next/headers";
import { ATLAS_ACCESS_TOKEN_COOKIE } from "./auth-cookies";

function readCookieFromRequest(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) {
    return null;
  }

  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) {
      return rest.join("=") || null;
    }
  }

  return null;
}

function getBearerToken(req: Request): string | null {
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

export async function extractAccessToken(req: Request): Promise<string | null> {
  const bearer = getBearerToken(req);
  if (bearer) {
    return bearer;
  }

  const cookieToken = readCookieFromRequest(req, ATLAS_ACCESS_TOKEN_COOKIE);
  if (cookieToken) {
    return cookieToken;
  }

  const cookieStore = await cookies();
  return cookieStore.get(ATLAS_ACCESS_TOKEN_COOKIE)?.value ?? null;
}
