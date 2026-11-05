import { cookies } from "next/headers";

export type ForwardedCookie = {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax" | "strict" | "none";
    path: string;
    maxAge?: number;
    expires?: Date;
  };
};

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * One Set-Cookie header from the API, as the arguments for the web's cookie
 * store. The value is decoded because the store encodes it again, and the
 * cookie keeps its own Secure, SameSite, Path and lifetime: on https the
 * session cookie is `__Secure-atlas_session`, which a browser refuses without
 * Secure. HttpOnly is always set; no API cookie is meant for page scripts.
 */
export function parseForwardedSetCookie(header: string): ForwardedCookie | null {
  const segments = header.split(";").map((part) => part.trim());
  const [pair] = segments;
  if (!pair) return null;
  const eq = pair.indexOf("=");
  if (eq <= 0) return null;
  const name = pair.slice(0, eq).trim();
  if (!name) return null;

  const options: ForwardedCookie["options"] = {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
  };
  for (const segment of segments.slice(1)) {
    const separator = segment.indexOf("=");
    const key = (separator === -1 ? segment : segment.slice(0, separator)).trim().toLowerCase();
    const attribute = separator === -1 ? "" : segment.slice(separator + 1).trim();
    if (key === "secure") options.secure = true;
    else if (key === "path" && attribute.startsWith("/")) options.path = attribute;
    else if (key === "samesite") {
      const sameSite = attribute.toLowerCase();
      if (sameSite === "lax" || sameSite === "strict" || sameSite === "none") {
        options.sameSite = sameSite;
      }
    } else if (key === "max-age") {
      const maxAge = Number.parseInt(attribute, 10);
      if (Number.isFinite(maxAge)) options.maxAge = maxAge;
    } else if (key === "expires") {
      const expires = new Date(attribute);
      if (!Number.isNaN(expires.getTime())) options.expires = expires;
    }
  }
  // Max-Age wins over Expires, as it does in a browser.
  if (options.maxAge !== undefined) delete options.expires;

  return { name, value: decodeCookieValue(pair.slice(eq + 1).trim()), options };
}

/**
 * Mirrors Set-Cookie headers from an internal API response onto the web app's
 * cookie store. Only Server Actions and Route Handlers may mutate cookies;
 * callers from Server Components must refresh sessions in middleware instead.
 */
export async function applySetCookieHeaders(response: Response): Promise<void> {
  const setCookies = readSetCookieHeaders(response);

  if (setCookies.length === 0) {
    return;
  }

  const cookieStore = await cookies();

  for (const header of setCookies) {
    const cookie = parseForwardedSetCookie(header);
    if (cookie) cookieStore.set(cookie.name, cookie.value, cookie.options);
  }
}

function readSetCookieHeaders(response: Response): string[] {
  return typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
}

export function buildCookieHeaderFromPairs(
  cookies: Array<{ name: string; value: string }>,
): string {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}
