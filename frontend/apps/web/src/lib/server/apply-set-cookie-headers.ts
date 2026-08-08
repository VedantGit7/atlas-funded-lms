import { cookies } from "next/headers";

/**
 * Mirrors Set-Cookie headers from an internal API response onto the web app's
 * cookie store. Only Server Actions and Route Handlers may mutate cookies;
 * callers from Server Components must refresh sessions in middleware instead.
 */
export async function applySetCookieHeaders(response: Response): Promise<void> {
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];

  if (setCookies.length === 0) {
    return;
  }

  const cookieStore = await cookies();

  for (const header of setCookies) {
    const segments = header.split(";").map((part) => part.trim());
    const [pair] = segments;
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!name) continue;

    let maxAge: number | undefined;
    for (const segment of segments.slice(1)) {
      const lower = segment.toLowerCase();
      if (lower.startsWith("max-age=")) {
        const parsed = Number.parseInt(segment.slice("max-age=".length), 10);
        if (Number.isFinite(parsed)) {
          maxAge = parsed;
        }
      }
    }

    cookieStore.set(name, value, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      ...(maxAge !== undefined ? { maxAge } : {}),
    });
  }
}

export function readSetCookieHeaders(response: Response): string[] {
  return typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [];
}

export function parseSetCookieHeader(header: string): { name: string; value: string } | null {
  const segments = header.split(";").map((part) => part.trim());
  const [pair] = segments;
  if (!pair) return null;
  const eq = pair.indexOf("=");
  if (eq <= 0) return null;
  const name = pair.slice(0, eq).trim();
  const value = pair.slice(eq + 1).trim();
  if (!name) return null;
  return { name, value };
}

export function mergeRequestCookieHeader(
  req: { cookies: { getAll: () => Array<{ name: string; value: string }> } },
  refreshResponse: Response,
): string {
  return mergeCookieHeaderString(buildCookieHeaderFromPairs(req.cookies.getAll()), refreshResponse);
}

export function buildCookieHeaderFromPairs(
  cookies: Array<{ name: string; value: string }>,
): string {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

export function mergeCookieHeaderString(
  cookieHeader: string,
  refreshResponse: Response,
): string {
  const cookieMap = new Map<string, string>();

  for (const segment of cookieHeader.split(";")) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    cookieMap.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }

  for (const header of readSetCookieHeaders(refreshResponse)) {
    const parsed = parseSetCookieHeader(header);
    if (parsed) {
      cookieMap.set(parsed.name, parsed.value);
    }
  }

  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

export function appendSetCookieHeaders(target: Headers, response: Response): void {
  for (const header of readSetCookieHeaders(response)) {
    target.append("Set-Cookie", header);
  }
}
