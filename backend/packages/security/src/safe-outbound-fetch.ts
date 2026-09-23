import {
  abortError,
  BlockedOutboundRequestError,
  parseOutboundUrl,
  resolveOutboundAddress,
  withAbort,
} from "./outbound-policy";
import { OUTBOUND_MAX_BYTES, pinnedOutboundTransport } from "./pinned-outbound-transport";

export { BlockedOutboundRequestError, isBlockedAddress } from "./outbound-policy";

/** Validation only. Sending must use safeOutboundFetch so DNS stays pinned. */
export async function assertOutboundUrlAllowed(rawUrl: string): Promise<URL> {
  const url = parseOutboundUrl(rawUrl);
  await withAbort(resolveOutboundAddress(url), AbortSignal.timeout(15_000));
  return url;
}

async function readRequestBody(request: Request, signal: AbortSignal): Promise<Uint8Array | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const result = await withAbort(reader.read(), signal);
      if (result.done) break;
      size += result.value.byteLength;
      if (size > OUTBOUND_MAX_BYTES)
        throw new BlockedOutboundRequestError(
          "Outbound request exceeds size limit",
          "REQUEST_TOO_LARGE",
        );
      chunks.push(result.value);
    }
    return Buffer.concat(chunks);
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

/**
 * Bounded HTTP(S) for tenant webhooks. All resolved addresses must be public;
 * one is pinned to a fresh socket, preserving Host and TLS certificate identity.
 * No redirects, proxy agents, compressed responses or transport overrides.
 * Buffers <=1 MiB per body; the 15s deadline includes DNS and the complete body.
 */
export async function safeOutboundFetch(rawUrl: string, init: RequestInit = {}): Promise<Response> {
  const deadline = new AbortController();
  const timer = setTimeout(() => {
    deadline.abort(
      new BlockedOutboundRequestError("Outbound request deadline exceeded", "REQUEST_TIMEOUT"),
    );
  }, 15_000);
  const signal = init.signal ? AbortSignal.any([init.signal, deadline.signal]) : deadline.signal;
  try {
    signal.throwIfAborted();
    const url = parseOutboundUrl(rawUrl);
    // Request normalizes BodyInit/Headers; none of init is passed to Node options.
    const request = new Request(url, init);
    const forbidden = [
      "host",
      "connection",
      "content-length",
      "transfer-encoding",
      "upgrade",
      "proxy-authorization",
      "proxy-connection",
      "expect",
      "trailer",
      "te",
    ];
    if (forbidden.some((header) => request.headers.has(header))) {
      throw new BlockedOutboundRequestError(
        "Outbound transport headers cannot be overridden",
        "BLOCKED_HEADERS",
      );
    }
    const body = await readRequestBody(request, signal);
    const address = await withAbort(resolveOutboundAddress(url), signal);
    signal.throwIfAborted();
    const headers = Object.fromEntries(request.headers);
    headers["host"] = url.host;
    headers["accept-encoding"] = "identity";
    headers["connection"] = "close";
    if (body) headers["content-length"] = String(body.byteLength);
    return await pinnedOutboundTransport(url, address, request.method, headers, body, signal);
  } catch (error) {
    if (error instanceof BlockedOutboundRequestError) throw error;
    if (signal.aborted) throw abortError(signal);
    throw new BlockedOutboundRequestError(
      "Outbound request could not be completed",
      "REQUEST_FAILED",
    );
  } finally {
    clearTimeout(timer);
  }
}
