import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { createServer as createHttpsServer } from "node:https";
import type * as HttpsModule from "node:https";
import type { RequestOptions as HttpsRequestOptions } from "node:https";
import { readFileSync } from "node:fs";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pinnedOutboundTransport } from "@atlas/security/pinned-outbound-transport";

// Only the low-level socket adapter receives loopback here. The public wrapper
// rejects it (unit tests). No production policy bypass/test flag is introduced.
const servers: Server[] = [];
const timers: ReturnType<typeof setInterval>[] = [];
const trust = vi.hoisted(() => ({ ca: undefined as string | undefined }));
vi.mock("node:https", async (importOriginal) => {
  const actual = await importOriginal<typeof HttpsModule>();
  return {
    ...actual,
    // Test-only trust injection; real DNS pinning, TLS handshake, certificate
    // identity checks and sockets are unchanged. Compatible with CI Node 22.
    request: (
      url: URL,
      options: HttpsRequestOptions,
      callback: (response: IncomingMessage) => void,
    ) => actual.request(url, { ...options, ...(trust.ca ? { ca: trust.ca } : {}) }, callback),
  };
});
const cert = readFileSync("tests/fixtures/outbound-tls/cert.pem", "utf8");
const key = readFileSync("tests/fixtures/outbound-tls/key.pem", "utf8");
afterEach(async () => {
  trust.ca = undefined;
  for (const timer of timers.splice(0)) clearInterval(timer);
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});

async function serve(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
  tls = false,
) {
  const server = tls ? createHttpsServer({ key, cert }, handler) : createHttpServer(handler);
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  return {
    server,
    url: new URL(`${tls ? "https" : "http"}://hooks.example.test:${port}/hook?q=value`),
  };
}
function send(url: URL, signal = AbortSignal.timeout(2000), method = "POST") {
  return pinnedOutboundTransport(
    url,
    { address: "127.0.0.1", family: 4 },
    method,
    { host: url.host, "content-type": "application/json", "accept-encoding": "identity" },
    method === "HEAD" ? null : Buffer.from('{"event":"test"}'),
    signal,
  );
}

describe("F06 native socket transport (loopback fixtures only)", () => {
  it("connects to the pin while preserving the HTTP authority, method and JSON body", async () => {
    let received: { host?: string; method?: string; path?: string; body: string } | undefined;
    const { url } = await serve((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        received = {
          host: req.headers.host,
          method: req.method,
          path: req.url,
          body: Buffer.concat(chunks).toString(),
        };
        res.setHeader("x-fixture", "yes");
        res.end("accepted");
      });
    });
    const response = await send(url);
    expect(received).toEqual({
      host: url.host,
      method: "POST",
      path: "/hook?q=value",
      body: '{"event":"test"}',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("x-fixture")).toBe("yes");
    expect(response.url).toBe(url.href);
    await expect(response.text()).resolves.toBe("accepted");
  });
  it("verifies a trusted certificate for the original hostname and sends SNI", async () => {
    trust.ca = cert;
    let sni = "";
    const { server, url } = await serve((_req, res) => res.end("secure"), true);
    server.on("secureConnection", (socket: { servername: string }) => {
      sni = socket.servername;
    });
    await expect((await send(url)).text()).resolves.toBe("secure");
    expect(sni).toBe("hooks.example.test");
  });
  it("rejects an untrusted certificate before sending the HTTP payload", async () => {
    let hits = 0;
    const { url } = await serve((_req, res) => {
      hits++;
      res.end();
    }, true);
    await expect(send(url)).rejects.toMatchObject({ reason: "REQUEST_FAILED" });
    expect(hits).toBe(0);
  });
  it("rejects a hostname mismatch despite a trusted certificate", async () => {
    trust.ca = cert;
    let hits = 0;
    const { url } = await serve((_req, res) => {
      hits++;
      res.end();
    }, true);
    url.hostname = "wrong.example.test";
    await expect(send(url)).rejects.toMatchObject({ reason: "REQUEST_FAILED" });
    expect(hits).toBe(0);
  });
  it("closes a redirect without sending a second request", async () => {
    let hits = 0;
    const { url } = await serve((_req, res) => {
      hits++;
      res.writeHead(302, { location: "http://169.254.169.254/" });
      res.end();
    });
    await expect(send(url)).rejects.toMatchObject({ reason: "BLOCKED_REDIRECT" });
    expect(hits).toBe(1);
  });
  it("rejects an oversized declared response before waiting for the body", async () => {
    const { url } = await serve((_req, res) => {
      res.writeHead(200, { "content-length": 1024 * 1024 + 1 });
      res.flushHeaders();
    });
    await expect(send(url)).rejects.toMatchObject({ reason: "RESPONSE_TOO_LARGE" });
  });
  it("counts actual chunked response bytes", async () => {
    const { url } = await serve((_req, res) => {
      res.writeHead(200);
      res.write(Buffer.alloc(512 * 1024));
      res.end(Buffer.alloc(512 * 1024 + 1));
    });
    await expect(send(url)).rejects.toMatchObject({ reason: "RESPONSE_TOO_LARGE" });
  });
  it("caps response headers", async () => {
    const { url } = await serve((_req, res) => {
      res.setHeader("x-big", "x".repeat(20 * 1024));
      res.end();
    });
    await expect(send(url)).rejects.toMatchObject({ reason: "REQUEST_FAILED" });
  });
  it("aborts a connection waiting for headers", async () => {
    const { url } = await serve(() => {});
    await expect(send(url, AbortSignal.timeout(100))).rejects.toMatchObject({
      reason: "REQUEST_ABORTED",
    });
  });
  it("aborts a slow trickle even while data keeps arriving", async () => {
    const { url } = await serve((_req, res) => {
      res.writeHead(200);
      res.flushHeaders();
      timers.push(setInterval(() => res.write("x"), 10));
    });
    await expect(send(url, AbortSignal.timeout(100))).rejects.toMatchObject({
      reason: "REQUEST_ABORTED",
    });
  });
  it("rejects a truncated Content-Length body", async () => {
    const { url } = await serve((_req, res) => {
      res.writeHead(200, { "content-length": 100 });
      res.write("short");
      setImmediate(() => res.destroy());
    });
    await expect(send(url)).rejects.toMatchObject({ reason: "REQUEST_FAILED" });
  });
  it.each([204, 205])("supports bodyless HTTP %i", async (status) => {
    const { url } = await serve((_req, res) => {
      res.writeHead(status);
      res.end();
    });
    expect((await send(url)).status).toBe(status);
  });
  it("supports HEAD without consuming an imaginary Content-Length body", async () => {
    const { url } = await serve((_req, res) => {
      res.writeHead(200, { "content-length": 10 });
      res.end();
    });
    await expect((await send(url, AbortSignal.timeout(2000), "HEAD")).text()).resolves.toBe("");
  });
});
