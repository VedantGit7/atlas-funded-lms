/**
 * Client IP resolution for rate limiting.
 *
 * Audit finding L5: the rate limiter took the FIRST entry of `x-forwarded-for`
 * unconditionally. That entry is fully attacker-controlled — any client can send
 * `X-Forwarded-For: <random>` and get a fresh bucket on every request, which
 * makes the limiter decorative against exactly the actor it exists to stop.
 *
 * The fix is the standard trusted-hop model. A proxy APPENDS the peer address it
 * actually observed, so with N trusted proxies in front of the app the real
 * client is the Nth entry counted from the RIGHT. Anything a client injects gets
 * pushed further left and is ignored.
 *
 * Configuration:
 *   TRUSTED_PROXY_HOPS      number of proxies in front of the app (default 1)
 *   TRUSTED_CLIENT_IP_HEADER  optional single-value header set by the edge that
 *                             cannot be spoofed through it (e.g. cf-connecting-ip
 *                             behind Cloudflare, true-client-ip behind Akamai).
 *                             Takes precedence when present.
 *
 * With hops = 0 the app is assumed to be directly reachable and forwarding
 * headers are ignored entirely.
 */

const UNKNOWN_CLIENT = "unknown";

function parseHops(env: NodeJS.ProcessEnv): number {
  const raw = env["TRUSTED_PROXY_HOPS"];
  if (raw === undefined || raw.trim() === "") return 1;

  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`TRUSTED_PROXY_HOPS must be a non-negative integer (got "${raw}").`);
  }
  return parsed;
}

/**
 * Returns the client identifier to bucket on, or `"unknown"` when it cannot be
 * established. `"unknown"` is deliberately a single shared bucket: callers we
 * cannot attribute get throttled together rather than each getting a free pass.
 */
export function resolveClientIp(req: Request, env: NodeJS.ProcessEnv = process.env): string {
  const trustedHeader = env["TRUSTED_CLIENT_IP_HEADER"]?.trim().toLowerCase();
  if (trustedHeader) {
    const value = req.headers.get(trustedHeader)?.trim();
    // A trusted edge header is single-valued. If it arrived as a list the edge
    // did not set it, so it is not trustworthy.
    if (value && !value.includes(",")) return value;
    return UNKNOWN_CLIENT;
  }

  const hops = parseHops(env);
  if (hops === 0) return UNKNOWN_CLIENT;

  const forwarded = req.headers.get("x-forwarded-for");
  if (!forwarded) return UNKNOWN_CLIENT;

  const entries = forwarded
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  // Fewer entries than trusted hops means our own proxies did not append —
  // the header did not travel the path we configured for. Do not trust it.
  if (entries.length < hops) return UNKNOWN_CLIENT;

  return entries[entries.length - hops] ?? UNKNOWN_CLIENT;
}
