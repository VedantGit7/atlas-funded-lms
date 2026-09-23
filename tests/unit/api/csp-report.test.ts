import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../../backend/apps/api/src/app/api/v1/public/security/csp-report/route";
import { enforcePublicRateLimit } from "../../../backend/packages/api/src/rate-limit";
import {
  MemoryRateLimitStore,
  setRateLimitStore,
} from "../../../backend/packages/api/src/rate-limit-store";

const logs = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));
vi.mock("../../../backend/packages/observability/src/logger", () => ({ structuredLogger: logs }));

const requestId = "req_00000000-0000-4000-8000-000000000001";
const legacy = {
  "csp-report": {
    "document-uri": "https://user:password@tenant.example.com/private?token=secret#hash",
    "blocked-uri": "https://cdn.example.com/private-script.js?token=secret",
    "source-file": "https://tenant.example.com/user/private.js?token=secret",
    "effective-directive": "script-src-elem",
    disposition: "report",
    "status-code": 200,
    "line-number": 3,
    "column-number": 7,
    "script-sample": "private sample secret",
    "original-policy": "policy secret",
    referrer: "https://private.example.com/referrer-secret",
    requestId: "client-request-secret",
    release: "client-release-secret",
  },
};
const modern = {
  type: "csp-violation",
  url: "https://private.example.com/ignored-secret",
  body: {
    documentURL: "https://tenant.example.com/private?secret",
    blockedURL: "inline",
    sourceFile: "https://cdn.example.com/source.js?secret",
    effectiveDirective: "script-src",
    disposition: "enforce",
    statusCode: 200,
    lineNumber: 12,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_ENV", "test");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("RELEASE_VERSION", "server-release");
  vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
  vi.stubEnv("TRUSTED_CLIENT_IP_HEADER", "");
  setRateLimitStore(new MemoryRateLimitStore());
});
afterEach(() => {
  setRateLimitStore(null);
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

function request(body: string | ReadableStream<Uint8Array>, headers: Record<string, string> = {}) {
  return new NextRequest("https://api.example.com/api/v1/public/security/csp-report", {
    method: "POST",
    headers: { "content-type": "application/csp-report", "x-request-id": requestId, ...headers },
    body,
    ...(typeof body === "string" ? {} : { duplex: "half" }),
  });
}
function reportLogs() {
  return logs.info.mock.calls
    .map(([entry]) => entry)
    .filter((entry) => entry.message === "csp.report.received");
}

it("accepts a legacy report as untrusted telemetry with only origins and server identity", async () => {
  const response = await POST(request(JSON.stringify(legacy)));
  expect(response.status).toBe(204);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.text()).toBe("");
  expect(reportLogs()).toEqual([
    expect.objectContaining({
      message: "csp.report.received",
      requestId,
      release: "server-release",
      trust: "untrusted",
      documentOrigin: "https://tenant.example.com",
      blockedOrigin: "https://cdn.example.com",
      sourceOrigin: "https://tenant.example.com",
      directive: "script-src-elem",
      disposition: "report",
      statusCode: 200,
      lineNumber: 3,
      columnNumber: 7,
    }),
  ]);
  expect(JSON.stringify(logs.info.mock.calls)).not.toMatch(
    /secret|password|original-policy|script-sample/,
  );
});

it("accepts at most ten Reporting API reports", async () => {
  const response = await POST(
    request(JSON.stringify(Array.from({ length: 10 }, () => modern)), {
      "content-type": "application/reports+json",
    }),
  );
  expect(response.status).toBe(204);
  expect(reportLogs()).toHaveLength(10);
  expect(reportLogs()[0]).toMatchObject({ blockedOrigin: "inline", disposition: "enforce" });
});

it.each([
  "data:text/javascript,secret",
  "blob:https://tenant.example.com/private-secret",
  "inline",
  "eval",
])("reduces special blocked source %s to its category", async (blocked) => {
  const report = { "csp-report": { ...legacy["csp-report"], "blocked-uri": blocked } };
  expect((await POST(request(JSON.stringify(report)))).status).toBe(204);
  expect(reportLogs()[0].blockedOrigin).toBe(blocked.split(":")[0]);
  expect(JSON.stringify(reportLogs())).not.toContain("secret");
});

it.each([
  ["{not json secret", 400],
  ["null", 400],
  [JSON.stringify({}), 400],
  [JSON.stringify({ "csp-report": { ...legacy["csp-report"], disposition: "secret" } }), 400],
  [JSON.stringify({ "csp-report": { ...legacy["csp-report"], disposition: ["report"] } }), 400],
  [
    JSON.stringify({
      "csp-report": { ...legacy["csp-report"], "effective-directive": "script-src secret" },
    }),
    400,
  ],
  [JSON.stringify({ "csp-report": { ...legacy["csp-report"], "status-code": 999 } }), 400],
  [JSON.stringify({ "csp-report": { ...legacy["csp-report"], "line-number": -1 } }), 400],
])("rejects malformed report without emitting telemetry (%s)", async (body, status) => {
  const response = await POST(request(String(body)));
  expect(response.status).toBe(status);
  expect(reportLogs()).toHaveLength(0);
  expect(JSON.stringify(logs.info.mock.calls)).not.toContain("secret");
});

it.each([[], Array.from({ length: 11 }, () => modern), [modern, { type: "other", body: {} }]])(
  "rejects empty, oversized, or partly invalid batches atomically",
  async (batch) => {
    expect(
      (await POST(request(JSON.stringify(batch), { "content-type": "application/reports+json" })))
        .status,
    ).toBe(400);
    expect(reportLogs()).toHaveLength(0);
  },
);

it.each([{ "content-type": "text/plain" }, { "content-encoding": "gzip" }])(
  "rejects unsupported representation before emitting telemetry",
  async (headers) => {
    expect((await POST(request(JSON.stringify(legacy), headers))).status).toBe(415);
    expect(reportLogs()).toHaveLength(0);
  },
);

it("rejects a declared oversized body before reading it", async () => {
  const response = await POST(request("{}", { "content-length": "16385" }));
  expect(response.status).toBe(413);
  expect(reportLogs()).toHaveLength(0);
});

it("enforces the byte limit on streamed bodies without Content-Length and cancels", async () => {
  const cancel = vi.fn();
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        controller.enqueue(new Uint8Array(8193));
        sent++;
      },
      cancel,
    },
    { highWaterMark: 0 },
  );
  expect((await POST(request(stream))).status).toBe(413);
  expect(cancel).toHaveBeenCalledOnce();
  expect(sent).toBe(2);
  expect(reportLogs()).toHaveLength(0);
});

it("accepts exactly 16 KiB and counts multibyte characters as bytes", async () => {
  const json = JSON.stringify(legacy);
  expect((await POST(request(json.padEnd(16384, " ")))).status).toBe(204);
  logs.info.mockClear();
  expect(
    (await POST(request(JSON.stringify({ ...legacy, padding: "é".repeat(8192) })))).status,
  ).toBe(413);
  expect(reportLogs()).toHaveLength(0);
});

it("exhausts the dedicated report budget before reading a body and leaves public reads available", async () => {
  for (let index = 0; index < 120; index++) {
    expect((await POST(request(JSON.stringify(legacy)))).status).toBe(204);
  }
  logs.info.mockClear();
  const response = await POST(request("not parsed secret"));
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBeTruthy();
  expect(reportLogs()).toHaveLength(0);
  await expect(
    enforcePublicRateLimit({ req: request(""), bucket: "publicRead", requestId }),
  ).resolves.toBeUndefined();
});

it("omits optional numeric telemetry when the browser does not supply it", async () => {
  expect(
    (
      await POST(
        request(
          JSON.stringify({
            "csp-report": {
              "document-uri": "https://tenant.example.com/private",
              "effective-directive": "script-src",
            },
          }),
        ),
      )
    ).status,
  ).toBe(204);
  for (const key of ["statusCode", "lineNumber", "columnNumber"]) {
    expect(Object.hasOwn(reportLogs()[0], key)).toBe(false);
  }
});

it("cancels a stalled body after five seconds without emitting telemetry", async () => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  let source!: ReadableStreamDefaultController<Uint8Array>;
  let started!: () => void;
  const reading = new Promise<void>((resolve) => {
    started = resolve;
  });
  const stream = new ReadableStream<Uint8Array>(
    {
      start(controller) {
        source = controller;
      },
      pull: () => {
        started();
      },
      cancel,
    },
    { highWaterMark: 0 },
  );
  const response = POST(request(stream));
  await reading;
  await vi.advanceTimersByTimeAsync(5_000);
  try {
    expect(cancel).toHaveBeenCalledOnce();
    expect((await response).status).toBe(408);
    expect(reportLogs()).toHaveLength(0);
  } finally {
    if (!cancel.mock.calls.length) source.close();
  }
});
