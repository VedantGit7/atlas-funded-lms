import { lookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { isIP } from "node:net";

export class BlockedOutboundRequestError extends Error {
  constructor(
    message: string,
    readonly reason:
      | "BLOCKED_PROTOCOL"
      | "BLOCKED_ADDRESS"
      | "BLOCKED_REDIRECT"
      | "UNRESOLVABLE_HOST"
      | "BLOCKED_HOST"
      | "BLOCKED_HEADERS"
      | "BLOCKED_ENCODING"
      | "REQUEST_TIMEOUT"
      | "REQUEST_ABORTED"
      | "REQUEST_TOO_LARGE"
      | "RESPONSE_TOO_LARGE"
      | "REQUEST_FAILED",
  ) {
    super(message);
    this.name = "BlockedOutboundRequestError";
  }
}

function ipv4Number(address: string): number {
  return address.split(".").reduce((value, octet) => value * 256 + Number(octet), 0);
}

function blockedIpv4(address: string): boolean {
  const value = ipv4Number(address);
  // Conservative public-unicast policy, including deprecated 6to4 relay space.
  return (
    [
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.0.2.0", 24],
      ["192.88.99.0", 24],
      ["192.168.0.0", 16],
      ["198.18.0.0", 15],
      ["198.51.100.0", 24],
      ["203.0.113.0", 24],
      ["224.0.0.0", 4],
      ["240.0.0.0", 4],
    ] as const
  ).some(([base, bits]) => {
    const mask = (-1 << (32 - bits)) >>> 0;
    return (value & mask) === (ipv4Number(base) & mask);
  });
}

function ipv6Number(address: string): bigint {
  // WHATWG canonicalization turns embedded dotted IPv4 into hex groups too.
  const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  const [left = "", right] = canonical.split("::");
  const leading = left ? left.split(":") : [];
  const trailing = right ? right.split(":") : [];
  const groups =
    right === undefined
      ? leading
      : [...leading, ...Array<string>(8 - leading.length - trailing.length).fill("0"), ...trailing];
  return groups.reduce((value, group) => (value << 16n) + BigInt(`0x${group}`), 0n);
}

export function isBlockedAddress(address: string): boolean {
  if (address.includes("%")) return true;
  const version = isIP(address);
  if (version === 4) return blockedIpv4(address);
  if (version !== 6) return true;
  const value = ipv6Number(address);
  if (value >> 32n === 0xffffn) {
    const embedded = Number(value & 0xffffffffn);
    return blockedIpv4(
      [embedded >>> 24, (embedded >>> 16) & 255, (embedded >>> 8) & 255, embedded & 255].join("."),
    );
  }
  // Global unicast only: exclude loopback, NAT64, ULA and multicast, then
  // special-purpose, documentation and 6to4 transition subranges within it.
  if (value >> 125n !== 1n) return true;
  const inPrefix = (base: string, bits: number) =>
    value >> BigInt(128 - bits) === ipv6Number(base) >> BigInt(128 - bits);
  return (
    inPrefix("2001::", 23) ||
    inPrefix("2001:db8::", 32) ||
    inPrefix("2002::", 16) ||
    inPrefix("3fff::", 20)
  );
}

export function parseOutboundUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BlockedOutboundRequestError("Invalid outbound URL", "BLOCKED_PROTOCOL");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new BlockedOutboundRequestError(
      "Protocol not allowed, or URL contains credentials/fragment",
      "BLOCKED_PROTOCOL",
    );
  }
  const allowlist = process.env["OUTBOUND_ALLOWED_HOSTS"]?.trim();
  if (allowlist) {
    const allowed = allowlist.split(",").map((entry) => entry.trim().toLowerCase());
    if (
      allowed.some((entry) => !entry || /[\s/@?#*]/.test(entry)) ||
      !allowed.includes(url.hostname.toLowerCase())
    ) {
      throw new BlockedOutboundRequestError(
        "Outbound hostname is not allowed by deployment policy",
        "BLOCKED_HOST",
      );
    }
  }
  return url;
}

export async function resolveOutboundAddress(url: URL): Promise<LookupAddress> {
  const literal = url.hostname.replace(/^\[|\]$/g, "");
  const family = isIP(literal);
  let answers: LookupAddress[];
  if (family) answers = [{ address: literal, family }];
  else {
    try {
      answers = await lookup(url.hostname, { all: true, verbatim: true });
    } catch {
      throw new BlockedOutboundRequestError("Could not resolve outbound host", "UNRESOLVABLE_HOST");
    }
  }
  if (!Array.isArray(answers) || !answers.length) {
    throw new BlockedOutboundRequestError("No usable outbound DNS answers", "UNRESOLVABLE_HOST");
  }
  if (
    answers.some(
      (answer) => isIP(answer.address) !== answer.family || isBlockedAddress(answer.address),
    )
  ) {
    throw new BlockedOutboundRequestError(
      "Outbound destination contains a blocked address",
      "BLOCKED_ADDRESS",
    );
  }
  const selected = answers[0];
  if (!selected)
    throw new BlockedOutboundRequestError("No usable outbound address", "UNRESOLVABLE_HOST");
  return selected;
}

export function abortError(signal: AbortSignal): BlockedOutboundRequestError {
  return signal.reason instanceof BlockedOutboundRequestError
    ? signal.reason
    : new BlockedOutboundRequestError("Outbound request cancelled", "REQUEST_ABORTED");
}

export function withAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(abortError(signal));
    };
    signal.addEventListener("abort", abort, { once: true });
    operation.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", abort);
    });
    if (signal.aborted) abort();
  });
}
