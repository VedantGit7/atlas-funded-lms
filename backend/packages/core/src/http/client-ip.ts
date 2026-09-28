import { isIP } from "node:net";

export const ATLAS_CLIENT_IP_HEADER = "x-atlas-client-ip";
export const ATLAS_PROXY_AUTHENTICATED_HEADER = "x-atlas-proxy-authenticated";

function parseHops(env: NodeJS.ProcessEnv): number {
  const raw = env["TRUSTED_PROXY_HOPS"]?.trim();
  if (!raw) return 0;
  const parsed = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(parsed)) {
    throw new Error("TRUSTED_PROXY_HOPS must be a non-negative integer.");
  }
  return parsed;
}

export function validateClientIpConfiguration(env: NodeJS.ProcessEnv = process.env): void {
  parseHops(env);
  const header = env["TRUSTED_CLIENT_IP_HEADER"]?.trim().toLowerCase();
  if (header && (!/^[a-z0-9-]+$/.test(header) || header.startsWith("x-atlas-"))) {
    throw new Error("Invalid TRUSTED_CLIENT_IP_HEADER.");
  }
}

export function normalizeClientIp(value: string): string {
  const trimmed = value.trim();
  if (isIP(trimmed) === 4) return trimmed;
  if (isIP(trimmed) === 6 && !trimmed.includes("%")) {
    return new URL(`http://[${trimmed}]/`).hostname.slice(1, -1);
  }
  return "unknown";
}

/** Only call at the web edge boundary whose overwrite/append policy is enforced. */
export function resolveEdgeClientIp(
  headers: Pick<Headers, "get">,
  env: NodeJS.ProcessEnv = process.env,
): string {
  validateClientIpConfiguration(env);
  const trustedHeader = env["TRUSTED_CLIENT_IP_HEADER"]?.trim().toLowerCase();
  if (trustedHeader) return normalizeClientIp(headers.get(trustedHeader) ?? "");
  const hops = parseHops(env);
  if (!hops) return "unknown";
  const entries =
    headers
      .get("x-forwarded-for")
      ?.split(",")
      .map((entry) => entry.trim()) ?? [];
  if (entries.length < hops || entries.some((entry) => !entry)) return "unknown";
  return normalizeClientIp(entries[entries.length - hops] ?? "");
}
