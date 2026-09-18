import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Outbound HTTP for tenant-configured URLs, with SSRF protections.
 *
 * Audit finding H3: four surfaces accept a URL from tenant configuration and
 * fetch it server-side — marketing integration webhooks (dispatch and test),
 * report delivery webhooks, and destination roster delivery. Validation was
 * `z.url()`, which checks syntax only. A probe confirmed the schema accepted
 * the cloud metadata address, loopback, RFC1918 and IPv6 loopback.
 *
 * Three protections are needed and all three matter:
 *
 *   1. Protocol allowlist — only http/https.
 *   2. Resolve the hostname, then check the resolved ADDRESS. Checking the
 *      hostname string alone is defeated by a DNS name that points at
 *      127.0.0.1.
 *   3. `redirect: "manual"` — otherwise an attacker-controlled public host can
 *      302 to an internal address and every check above is bypassed.
 */

export class BlockedOutboundRequestError extends Error {
  constructor(
    message: string,
    readonly reason:
      | "BLOCKED_PROTOCOL"
      | "BLOCKED_ADDRESS"
      | "BLOCKED_REDIRECT"
      | "UNRESOLVABLE_HOST",
  ) {
    super(message);
    this.name = "BlockedOutboundRequestError";
  }
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function ipv4ToInt(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;

  let value = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

/** RFC1918, loopback, link-local (incl. cloud metadata), CGNAT, broadcast, multicast. */
function isPrivateIpv4(address: string): boolean {
  const value = ipv4ToInt(address);
  if (value === null) return true; // unparseable: refuse rather than guess

  const inRange = (cidrBase: string, bits: number): boolean => {
    const base = ipv4ToInt(cidrBase);
    if (base === null) return false;
    const mask = bits === 0 ? 0 : (-1 << (32 - bits)) >>> 0;
    return (value & mask) === (base & mask);
  };

  return (
    inRange("0.0.0.0", 8) ||
    inRange("10.0.0.0", 8) ||
    inRange("100.64.0.0", 10) ||
    inRange("127.0.0.0", 8) ||
    inRange("169.254.0.0", 16) || // includes 169.254.169.254 cloud metadata
    inRange("172.16.0.0", 12) ||
    inRange("192.0.0.0", 24) ||
    inRange("192.168.0.0", 16) ||
    inRange("198.18.0.0", 15) ||
    inRange("224.0.0.0", 4) ||
    inRange("240.0.0.0", 4)
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalised = address.toLowerCase().split("%")[0] ?? "";

  if (normalised === "::1" || normalised === "::") return true;
  // Unique-local (fc00::/7) and link-local (fe80::/10).
  if (/^f[cd]/.test(normalised)) return true;
  if (/^fe[89ab]/.test(normalised)) return true;

  // IPv4-mapped addresses must be judged on the embedded IPv4. Two spellings
  // reach us: the dotted form (::ffff:127.0.0.1) and the hex form
  // (::ffff:7f00:1). WHATWG URL parsing normalises to the HEX form, so matching
  // only the dotted spelling let http://[::ffff:127.0.0.1]/ through.
  const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalised);
  if (dotted?.[1]) return isPrivateIpv4(dotted[1]);

  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(normalised);
  if (hex?.[1] && hex[2]) {
    const high = Number.parseInt(hex[1], 16);
    const low = Number.parseInt(hex[2], 16);
    const ipv4 = [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
    return isPrivateIpv4(ipv4);
  }

  return false;
}

export function isBlockedAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true; // not an IP literal: refuse rather than guess
}

export async function assertOutboundUrlAllowed(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BlockedOutboundRequestError(`Invalid URL: ${rawUrl}`, "BLOCKED_PROTOCOL");
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new BlockedOutboundRequestError(
      `Protocol not allowed: ${url.protocol}`,
      "BLOCKED_PROTOCOL",
    );
  }

  // A bare IP literal never needs resolving.
  const literal = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(literal)) {
    if (isBlockedAddress(literal)) {
      throw new BlockedOutboundRequestError(`Blocked address: ${literal}`, "BLOCKED_ADDRESS");
    }
    return url;
  }

  let resolved: Awaited<ReturnType<typeof lookup>>;
  try {
    resolved = await lookup(url.hostname, { all: false });
  } catch {
    throw new BlockedOutboundRequestError(
      `Could not resolve host: ${url.hostname}`,
      "UNRESOLVABLE_HOST",
    );
  }

  if (isBlockedAddress(resolved.address)) {
    throw new BlockedOutboundRequestError(
      `Host ${url.hostname} resolves to a blocked address (${resolved.address})`,
      "BLOCKED_ADDRESS",
    );
  }

  return url;
}

/**
 * Drop-in replacement for `fetch` on tenant-configured URLs.
 *
 * Redirects are never followed. A 3xx is surfaced to the caller rather than
 * chased, because following one would re-open every check above.
 */
export async function safeOutboundFetch(rawUrl: string, init: RequestInit = {}): Promise<Response> {
  const url = await assertOutboundUrlAllowed(rawUrl);

  const response = await fetch(url, { ...init, redirect: "manual" });

  if (response.status >= 300 && response.status < 400) {
    throw new BlockedOutboundRequestError(
      `Redirect not followed (${response.status}) for ${url.hostname}`,
      "BLOCKED_REDIRECT",
    );
  }

  return response;
}
