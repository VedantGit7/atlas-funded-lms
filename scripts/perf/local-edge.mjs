// An experiment-only loopback proxy. Never imported by application/runtime code.
import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PRIVATE_CONFIG_PATH } from "./capacity-fixture.mjs";

const origin = "http://fundedbeyond.localhost:3100";
const hopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);
export function validateEdgeRequest(req, token) {
  const supplied = req.headers["x-atlas-perf-token"];
  const actor = req.headers["x-atlas-perf-actor"];
  if (
    req.headers.host !== "fundedbeyond.localhost:3100" ||
    typeof supplied !== "string" ||
    supplied.length !== token.length ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(token)) ||
    typeof actor !== "string" ||
    !/^(0|[1-9]\d{0,2})$/.test(actor) ||
    Number(actor) > 199 ||
    !req.url?.startsWith("/") ||
    req.url.startsWith("//") ||
    req.url.includes("\\")
  )
    throw new Error("Invalid local fixture request.");
  return Number(actor);
}
function cleanHeaders(headers) {
  const connection = new Set(
    String(headers.connection ?? "")
      .toLowerCase()
      .split(",")
      .map((v) => v.trim()),
  );
  return Object.fromEntries(
    Object.entries(headers).filter(([key]) => !hopHeaders.has(key) && !connection.has(key)),
  );
}
export function forwardHeaders(headers, actor) {
  const clean = cleanHeaders(headers);
  for (const key of Object.keys(clean)) {
    if (
      key === "forwarded" ||
      key.startsWith("x-forwarded-") ||
      key.startsWith("x-atlas-") ||
      [
        "x-real-ip",
        "cf-connecting-ip",
        "true-client-ip",
        "client-ip",
        "x-client-ip",
        "x-cluster-client-ip",
        "fastly-client-ip",
      ].includes(key)
    )
      delete clean[key];
  }
  return {
    ...clean,
    host: "fundedbeyond.localhost:3100",
    "x-forwarded-for": `198.18.0.${actor + 1}`,
    "x-forwarded-proto": "http",
  };
}
export function createEdgeServer(token, request = http.request) {
  if (!/^[a-f0-9]{64}$/.test(token ?? ""))
    throw new Error("A private fixture proxy token is required.");
  return http.createServer(
    { requestTimeout: 120000, headersTimeout: 15000, maxHeaderSize: 32768 },
    async (req, res) => {
      let actor;
      try {
        actor = validateEdgeRequest(req, token);
      } catch {
        res.writeHead(403).end();
        req.resume();
        return;
      }
      const chunks = [];
      let bytes = 0;
      try {
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 1048576) {
            res.writeHead(413).end();
            return;
          }
          chunks.push(chunk);
        }
      } catch {
        if (!res.headersSent) res.writeHead(400).end();
        return;
      }
      const upstream = request(
        {
          hostname: "127.0.0.1",
          port: 3102,
          path: req.url,
          method: req.method,
          headers: forwardHeaders(req.headers, actor),
          timeout: 120000,
        },
        (incoming) => {
          if (incoming.headers.location) {
            try {
              if (new URL(incoming.headers.location, origin).origin !== origin) throw new Error();
            } catch {
              incoming.destroy();
              res.writeHead(502).end();
              return;
            }
          }
          res.writeHead(incoming.statusCode ?? 502, cleanHeaders(incoming.headers));
          let responseBytes = 0;
          incoming.on("data", (chunk) => {
            responseBytes += chunk.length;
            if (responseBytes > 5242880) {
              incoming.destroy();
              res.destroy();
            }
          });
          incoming.on("error", () => res.destroy());
          incoming.pipe(res);
        },
      );
      upstream.on("timeout", () => upstream.destroy());
      upstream.on("error", () => {
        if (!res.headersSent) res.writeHead(502).end();
        else res.destroy();
      });
      res.on("close", () => {
        if (!res.writableFinished) upstream.destroy();
      });
      upstream.end(Buffer.concat(chunks));
    },
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (!process.argv.includes("--ack-local-disposable")) throw new Error();
    const config = JSON.parse(readFileSync(PRIVATE_CONFIG_PATH, "utf8"));
    if (
      config.mode !== "local-endurance" ||
      config.origin !== origin ||
      config.disposableFixtures !== true
    )
      throw new Error();
    const server = createEdgeServer(config.fixtureProxyToken);
    server.on("error", () => {
      console.error("Local capacity edge could not start.");
      process.exitCode = 1;
    });
    server.listen(3100, "127.0.0.1", () =>
      console.log("Local capacity edge listening on 127.0.0.1:3100."),
    );
    for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.close());
  } catch {
    console.error(
      "Local capacity edge requires acknowledged private disposable fixture configuration.",
    );
    process.exitCode = 1;
  }
}
