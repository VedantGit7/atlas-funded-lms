import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest, type RequestOptions as HttpsRequestOptions } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import type { LookupAddress } from "node:dns";
import { abortError, BlockedOutboundRequestError } from "./outbound-policy";

export const OUTBOUND_MAX_BYTES = 1024 * 1024;

/** Native transport never resolves again, redirects, or uses a shared/proxy agent. */
export function pinnedOutboundTransport(
  url: URL,
  address: LookupAddress,
  method: string,
  headers: Record<string, string>,
  body: Uint8Array | null,
  signal: AbortSignal,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    let response: IncomingMessage | undefined;
    let settled = false;
    const lookup: LookupFunction = (_hostname, options, callback) => {
      if (signal.aborted) {
        callback(abortError(signal), "", 0);
        return;
      }
      if (options.all) callback(null, [address]);
      else callback(null, address.address, address.family);
    };
    const options: HttpsRequestOptions & { autoSelectFamily: boolean } = {
      method,
      headers,
      lookup,
      family: address.family,
      autoSelectFamily: false,
      agent: false,
      maxHeaderSize: 16 * 1024,
      rejectUnauthorized: true,
      ...(url.protocol === "https:" && !isIP(url.hostname.replace(/^\[|\]$/g, ""))
        ? { servername: url.hostname }
        : {}),
    };
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
      url,
      options,
      (incoming) => {
        response = incoming;
        if (settled) {
          incoming.destroy();
          return;
        }
        const status = incoming.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          fail(
            new BlockedOutboundRequestError(
              "Outbound redirects are not followed",
              "BLOCKED_REDIRECT",
            ),
          );
          return;
        }
        if (status < 200 || status > 599) {
          fail(new Error("Invalid status"));
          return;
        }
        const encoding = incoming.headers["content-encoding"];
        if (encoding && encoding !== "identity") {
          fail(
            new BlockedOutboundRequestError(
              "Encoded outbound responses are not accepted",
              "BLOCKED_ENCODING",
            ),
          );
          return;
        }
        const length = incoming.headers["content-length"];
        if (length && Number(length) > OUTBOUND_MAX_BYTES) {
          fail(
            new BlockedOutboundRequestError(
              "Outbound response exceeds size limit",
              "RESPONSE_TOO_LARGE",
            ),
          );
          return;
        }
        const chunks: Buffer[] = [];
        let total = 0;
        incoming.on("error", fail);
        incoming.on("aborted", () => {
          fail(new Error("Truncated response"));
        });
        incoming.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > OUTBOUND_MAX_BYTES) {
            fail(
              new BlockedOutboundRequestError(
                "Outbound response exceeds size limit",
                "RESPONSE_TOO_LARGE",
              ),
            );
          } else chunks.push(chunk);
        });
        incoming.on("end", () => {
          if (settled) return;
          try {
            const responseHeaders = new Headers();
            for (let index = 0; index < incoming.rawHeaders.length; index += 2) {
              const name = incoming.rawHeaders[index];
              const value = incoming.rawHeaders[index + 1];
              if (name === undefined || value === undefined) throw new Error("Invalid headers");
              responseHeaders.append(name, value);
            }
            const result = new Response(
              method === "HEAD" || status === 204 || status === 205 ? null : Buffer.concat(chunks),
              { status, headers: responseHeaders },
            );
            Object.defineProperty(result, "url", { value: url.href });
            settled = true;
            signal.removeEventListener("abort", onAbort);
            // A peer may finish its reply before consuming our upload. No
            // queued write or socket may outlive the bounded operation.
            request.destroy();
            resolve(result);
          } catch (error) {
            fail(error);
          }
        });
      },
    );
    function fail(error: unknown) {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      response?.destroy();
      request.destroy();
      reject(
        error instanceof BlockedOutboundRequestError
          ? error
          : new BlockedOutboundRequestError(
              "Outbound connection or response failed",
              "REQUEST_FAILED",
            ),
      );
    }
    function onAbort() {
      fail(abortError(signal));
    }
    request.on("error", fail);
    request.on("upgrade", (_incoming, socket) => {
      socket.destroy();
      fail(new Error("Upgrade refused"));
    });
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }
    request.end(body);
  });
}
