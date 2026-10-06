import { createServer, type IncomingHttpHeaders, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { matchingUploadRule, type CorsRule } from "@atlas/storage/r2-cors";

/**
 * A stand-in for R2's answer to a CORS preflight, for tests: it decides from
 * the rules it holds, as S3 does (first matching rule; 403 when none allows
 * the request), and records what it was sent. `respond` overrides the answer.
 */
export async function startFakeR2Preflight(rules: CorsRule[]) {
  const state = {
    rules,
    /** Rules written but not yet served, for propagation tests. */
    pending: null as CorsRule[] | null,
    servePendingAfter: 0,
    requests: [] as IncomingHttpHeaders[],
    methods: [] as string[],
    respond: null as ((res: ServerResponse) => void) | null,
  };
  const server = createServer((req, res) => {
    state.requests.push(req.headers);
    state.methods.push(req.method ?? "");
    if (state.pending && state.servePendingAfter-- <= 0) {
      state.rules = state.pending;
      state.pending = null;
    }
    if (state.respond) {
      state.respond(res);
      return;
    }
    if (req.method !== "OPTIONS" || req.headers["access-control-request-method"] !== "PUT") {
      res.writeHead(400).end();
      return;
    }
    const origin = String(req.headers.origin ?? "");
    const headers = String(req.headers["access-control-request-headers"] ?? "")
      .split(",")
      .map((header) => header.trim())
      .filter(Boolean);
    const rule = matchingUploadRule(state.rules, origin, headers);
    if (!rule) {
      res.writeHead(403).end("CORSResponse: This CORS request is not allowed.");
      return;
    }
    res
      .writeHead(200, {
        "access-control-allow-origin": rule.AllowedOrigins?.includes("*") ? "*" : origin,
        "access-control-allow-methods": "PUT",
        "access-control-allow-headers": headers.join(", "),
        "access-control-max-age": String(rule.MaxAgeSeconds ?? 0),
      })
      .end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    state,
    url: `http://127.0.0.1:${String(port)}/atlas-assets/_atlas/cors-probe/upload-preflight?X-Amz-Signature=probe`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
