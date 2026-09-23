import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { once } from "node:events";
import { afterEach, expect, it } from "vitest";

const servers: Server[] = [];
const release = "release-under-test";

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(async (server) => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }),
  );
});

function healthy(index: number) {
  return {
    ok: true,
    service: "atlas-lms",
    status: "healthy",
    requestId: `request-${index}`,
    release,
    environment: "test",
  };
}

function reply(response: ServerResponse, index: number, overrides = {}) {
  response.setHeader("x-request-id", `request-${index}`);
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify({ ...healthy(index), ...overrides }));
}

async function serve(
  handler: (response: ServerResponse, index: number, url: string, request: IncomingMessage) => void,
) {
  let requests = 0;
  const server = createServer((request, response) => {
    response.setHeader("connection", "close");
    handler(response, ++requests, request.url ?? "", request);
  });
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server address");
  return { url: `http://127.0.0.1:${address.port}`, requests: () => requests };
}

async function run(
  baseUrl: string,
  env: Record<string, string> = {},
  args: string[] = [],
  noNetwork = false,
) {
  const command = noNetwork
    ? [
        "--input-type=module",
        "--eval",
        'globalThis.fetch = () => { throw new Error("Unexpected network request"); }; await import("./scripts/observability/release-health.mjs");',
      ]
    : ["scripts/observability/release-health.mjs", ...args];
  const child = spawn(process.execPath, command, {
    env: {
      ...process.env,
      DATABASE_URL: "",
      RELEASE_HEALTH_BASE_URL: baseUrl,
      RELEASE_HEALTH_EXPECTED_RELEASE: release,
      RELEASE_HEALTH_TIMEOUT_MS: "1000",
      VERCEL_AUTOMATION_BYPASS_SECRET: "",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (data: Buffer) => (stdout += data.toString()));
  child.stderr.on("data", (data: Buffer) => (stderr += data.toString()));
  const timeout = setTimeout(() => child.kill(), 5_000);
  try {
    const [code] = await once(child, "close");
    expect(stderr).toBe("");
    return { code, stdout, result: JSON.parse(stdout) };
  } finally {
    clearTimeout(timeout);
  }
}

it("accepts two healthy responses with the expected release and independent matching IDs", async () => {
  const server = await serve((response, index) => reply(response, index));
  const { code, result } = await run(server.url);
  expect(code).toBe(0);
  expect(result).toMatchObject({ ok: true, release, requestIds: ["request-1", "request-2"] });
  expect(server.requests()).toBe(2);
});

it.each(["", "   "])(
  "requires a nonblank expected release (%j) before making requests",
  async (value) => {
    const server = await serve((response, index) => reply(response, index));
    const { code, result } = await run(server.url, { RELEASE_HEALTH_EXPECTED_RELEASE: value });
    expect(code).toBe(1);
    expect(result.failures.join(" ")).toMatch(/expected.release/i);
    expect(server.requests()).toBe(0);
  },
);

it("accepts a trimmed expected-release argument overriding the environment", async () => {
  const server = await serve((response, index) => reply(response, index));
  expect((await run(server.url, {}, ["--expected-release", `  ${release}  `])).code).toBe(0);
});

it("does not accept a blank expected-release argument", async () => {
  const server = await serve((response, index) => reply(response, index));
  expect((await run(server.url, {}, ["--expected-release", "   "])).code).toBe(1);
  expect(server.requests()).toBe(0);
});

it.each(["ok", "service", "status", "requestId", "release"])(
  "rejects an invalid %s in the second response",
  async (field) => {
    const server = await serve((response, index) =>
      reply(response, index, index === 2 ? { [field]: field === "ok" ? false : "wrong" } : {}),
    );
    const { code, result } = await run(server.url);
    expect(code).toBe(1);
    expect(result.ok).toBe(false);
  },
);

it.each([1, 2])("rejects body/header request-ID mismatch in response %s", async (probe) => {
  const server = await serve((response, index) =>
    reply(response, index, index === probe ? { requestId: "different" } : {}),
  );
  expect((await run(server.url)).code).toBe(1);
});

it("rejects duplicate independent request IDs", async () => {
  const server = await serve((response) => reply(response, 1));
  expect((await run(server.url)).code).toBe(1);
});

it("rejects a missing request-ID header", async () => {
  const server = await serve((response, index) => response.end(JSON.stringify(healthy(index))));
  expect((await run(server.url)).code).toBe(1);
});

it("rejects a non-success status on the second response", async () => {
  const server = await serve((response, index) => {
    response.statusCode = index === 2 ? 503 : 200;
    reply(response, index);
  });
  expect((await run(server.url)).code).toBe(1);
});

it.each([301, 302, 307, 308])("rejects HTTP %s without following its target", async (status) => {
  const server = await serve((response, index, url) => {
    if (url === "/api/v1/health") {
      response.writeHead(status, { location: "/redirect-target?token=secret-redirect" });
      response.end();
    } else reply(response, index);
  });
  const { code, stdout } = await run(server.url);
  expect(code).toBe(1);
  expect(server.requests()).toBe(1);
  expect(stdout).not.toContain("secret-redirect");
});

it.each(["headers", "body"])("bounds waiting for stalled response %s", async (stage) => {
  const server = await serve((response, index) => {
    if (stage === "body") {
      response.writeHead(200, {
        "content-type": "application/json",
        "x-request-id": `request-${index}`,
      });
      response.flushHeaders();
    }
    const timer = setTimeout(() => response.end(JSON.stringify(healthy(index))), 800);
    response.on("close", () => clearTimeout(timer));
  });
  const { code, result } = await run(server.url, { RELEASE_HEALTH_TIMEOUT_MS: "100" });
  expect(code).toBe(1);
  expect(result.failures.join(" ")).toMatch(/timeout|timed out/i);
});

it.each(["0", "-1", "Infinity", "30001", "garbage"])(
  "rejects unsafe timeout %s",
  async (timeout) => {
    const server = await serve((response, index) => reply(response, index));
    const { code, result } = await run(server.url, { RELEASE_HEALTH_TIMEOUT_MS: timeout });
    expect(code).toBe(1);
    expect(result.failures.join(" ")).toMatch(/timeout/i);
    expect(server.requests()).toBe(0);
  },
);

it("does not include response secrets in JSON parse errors", async () => {
  const server = await serve((response) => response.end("secret-response-token is not JSON"));
  const { code, stdout } = await run(server.url);
  expect(code).toBe(1);
  expect(stdout).not.toContain("secret-response-token");
});

it("omits query and fragment secrets from reported URLs", async () => {
  const server = await serve((response, index) => reply(response, index));
  const { code, stdout } = await run(`${server.url}/?token=secret-query#secret-fragment`);
  expect(code).toBe(0);
  expect(stdout).not.toContain("secret-query");
  expect(stdout).not.toContain("secret-fragment");
});

it("reports malformed URLs as safe structured errors", async () => {
  const { code, stdout, result } = await run("not-a-url-secret");
  expect(code).toBe(1);
  expect(result.ok).toBe(false);
  expect(stdout).not.toContain("not-a-url-secret");
});

it("sends a configured Vercel bypass secret only in the request header and never logs it", async () => {
  const received: unknown[] = [];
  const server = await serve((response, index, _url, request) => {
    received.push(request.headers["x-vercel-protection-bypass"]);
    reply(response, index);
  });
  const secret = "test-only-vercel-bypass-secret";
  const { code, stdout } = await run(server.url, { VERCEL_AUTOMATION_BYPASS_SECRET: secret });
  expect(code).toBe(0);
  expect(received).toEqual([secret, secret]);
  expect(stdout).not.toContain(secret);
});

it("never forwards the Vercel bypass secret to a redirect target", async () => {
  const target = await serve((response, index) => reply(response, index));
  const received: unknown[] = [];
  const server = await serve((response, _index, _url, request) => {
    received.push(request.headers["x-vercel-protection-bypass"]);
    response.writeHead(302, { location: target.url });
    response.end();
  });
  const secret = "test-only-vercel-redirect-secret";
  const { code, stdout } = await run(server.url, { VERCEL_AUTOMATION_BYPASS_SECRET: secret });
  expect(code).toBe(1);
  expect(received).toEqual([secret]);
  expect(target.requests()).toBe(0);
  expect(stdout).not.toContain(secret);
});

it("does not send an unconfigured Vercel bypass header", async () => {
  const received: unknown[] = [];
  const server = await serve((response, index, _url, request) => {
    received.push(request.headers["x-vercel-protection-bypass"]);
    reply(response, index);
  });
  expect((await run(server.url)).code).toBe(0);
  expect(received).toEqual([undefined, undefined]);
});

it.each(["http://example.invalid", "http://127.0.0.1.example.invalid", "http://192.0.2.1"])(
  "rejects non-loopback plain HTTP before attempting a probe (%s)",
  async (url) => {
    const { code, stdout, result } = await run(
      url,
      { VERCEL_AUTOMATION_BYPASS_SECRET: "test-only-http-secret" },
      [],
      true,
    );
    expect(code).toBe(1);
    expect(result.failures).toEqual(["Invalid health base URL"]);
    expect(stdout).not.toContain("test-only-http-secret");
  },
);
