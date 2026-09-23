import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { IncomingMessage, RequestOptions } from "node:http";
import type { RequestOptions as HttpsOptions } from "node:https";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertOutboundUrlAllowed,
  isBlockedAddress,
  safeOutboundFetch,
} from "@atlas/security/safe-outbound-fetch";

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:http", () => ({ request: mocks.request }));
vi.mock("node:https", () => ({ request: mocks.request }));

let reply: PassThrough & {
  statusCode: number;
  headers: Record<string, string>;
  rawHeaders: string[];
};
let connection: EventEmitter & { end: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.stubEnv("OUTBOUND_ALLOWED_HOSTS", "");
  mocks.lookup.mockReset().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  reply = Object.assign(new PassThrough(), { statusCode: 200, headers: {}, rawHeaders: [] });
  connection = Object.assign(new EventEmitter(), {
    end: vi.fn(() => {
      queueMicrotask(() => reply.end("ok"));
    }),
    destroy: vi.fn(() => {
      reply.destroy();
      return connection;
    }),
  });
  mocks.request
    .mockReset()
    .mockImplementation(
      (_url: URL, _options: RequestOptions, callback: (response: IncomingMessage) => void) => {
        queueMicrotask(() => callback(reply as unknown as IncomingMessage));
        return connection;
      },
    );
  // Old unpinned implementation is safe to exercise without network access.
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("old unpinned response")));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("F06 DNS and address boundary", () => {
  it.each(["http://127.1/", "http://2130706433/", "http://0x7f000001/"])(
    "rejects normalized loopback URL %s",
    async (url) => {
      await expect(safeOutboundFetch(url)).rejects.toMatchObject({ reason: "BLOCKED_ADDRESS" });
      expect(mocks.request).not.toHaveBeenCalled();
    },
  );
  it("rejects a mixed IPv4/public and IPv6/private DNS set", async () => {
    mocks.lookup.mockResolvedValue([
      { address: "8.8.8.8", family: 4 },
      { address: "fd00::1", family: 6 },
    ]);
    await expect(safeOutboundFetch("https://hooks.example.test/")).rejects.toMatchObject({
      reason: "BLOCKED_ADDRESS",
    });
  });
  it("pins a public IPv6 address without another resolver call", async () => {
    mocks.lookup.mockResolvedValue([{ address: "2606:4700:4700::1111", family: 6 }]);
    await safeOutboundFetch("https://hooks.example.test/");
    const options = mocks.request.mock.calls[0]?.[1] as HttpsOptions;
    if (!options.lookup) throw new Error("Missing lookup");
    const callback = vi.fn();
    options.lookup("hooks.example.test", { all: true }, callback);
    expect(callback).toHaveBeenCalledWith(null, [{ address: "2606:4700:4700::1111", family: 6 }]);
    expect(mocks.lookup).toHaveBeenCalledTimes(1);
  });
  it("enforces an exact deployment host allowlist before DNS", async () => {
    vi.stubEnv("OUTBOUND_ALLOWED_HOSTS", "hooks.example.test");
    await expect(safeOutboundFetch("https://hooks.example.test.evil.test/")).rejects.toMatchObject({
      reason: "BLOCKED_HOST",
    });
    expect(mocks.lookup).not.toHaveBeenCalled();
    await expect(safeOutboundFetch("https://hooks.example.test/")).resolves.toBeInstanceOf(
      Response,
    );
  });
  it("does not let an allowed hostname bypass address policy", async () => {
    vi.stubEnv("OUTBOUND_ALLOWED_HOSTS", "hooks.example.test");
    mocks.lookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    await expect(safeOutboundFetch("https://hooks.example.test/")).rejects.toMatchObject({
      reason: "BLOCKED_ADDRESS",
    });
  });
  it.each(["*.example.test", "hooks.example.test,", "hooks.example.test/path"])(
    "rejects malformed allowlist %s",
    async (hosts) => {
      vi.stubEnv("OUTBOUND_ALLOWED_HOSTS", hosts);
      await expect(safeOutboundFetch("https://hooks.example.test/")).rejects.toMatchObject({
        reason: "BLOCKED_HOST",
      });
    },
  );
  it("rejects a mixed public/private answer set before opening a socket", async () => {
    mocks.lookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ]);
    await expect(safeOutboundFetch("https://hooks.example.test/push")).rejects.toMatchObject({
      reason: "BLOCKED_ADDRESS",
    });
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("pins a single approved DNS snapshot even if DNS changes before connect", async () => {
    mocks.lookup.mockImplementation((_host, options) =>
      Promise.resolve(
        options.all
          ? [{ address: "93.184.216.34", family: 4 }]
          : { address: "93.184.216.34", family: 4 },
      ),
    );
    const response = await safeOutboundFetch("https://hooks.example.test/push", {
      method: "POST",
      body: "payload",
      headers: { "x-atlas-event": "test" },
    });
    expect(mocks.request).toHaveBeenCalledTimes(1);
    const [target, options] = mocks.request.mock.calls[0] as [URL, HttpsOptions];
    mocks.lookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    const callback = vi.fn();
    if (!options.lookup) throw new Error("Missing pinned lookup");
    options.lookup("hooks.example.test", { all: false }, callback);
    expect(callback).toHaveBeenCalledWith(null, "93.184.216.34", 4);
    expect(mocks.lookup).toHaveBeenCalledTimes(1);
    expect(mocks.lookup).toHaveBeenCalledWith("hooks.example.test", { all: true, verbatim: true });
    expect(target.hostname).toBe("hooks.example.test");
    expect(options).toMatchObject({
      agent: false,
      autoSelectFamily: false,
      rejectUnauthorized: true,
      method: "POST",
    });
    expect(options.headers).toMatchObject({ host: "hooks.example.test", "x-atlas-event": "test" });
    expect(options.servername).toBe("hooks.example.test");
    await expect(response.text()).resolves.toBe("ok");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it.each([
    "0:0:0:0:0:0:0:1",
    "0:0:0:0:0:ffff:7f00:1",
    "ff02::1",
    "64:ff9b::7f00:1",
    "2002:7f00:1::",
    "2001:db8::1",
    "192.0.2.1",
    "198.51.100.1",
    "203.0.113.1",
    "100::1",
    "3fff::1",
  ])("blocks non-public/transition address %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });
  it.each([[], [{ address: "not-an-ip", family: 4 }], [{ address: "8.8.8.8", family: 6 }]])(
    "fails closed for invalid DNS results %j",
    async (answers) => {
      mocks.lookup.mockResolvedValue(answers);
      await expect(assertOutboundUrlAllowed("https://hooks.example.test/")).rejects.toBeInstanceOf(
        Error,
      );
    },
  );
  it("does not leak malformed URL credentials in errors", async () => {
    const secret = "sensitive-password";
    const error = await safeOutboundFetch(`http://user:${secret}@[/`).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).not.toContain(secret);
  });
  it("rejects embedded credentials before dispatch", async () => {
    await expect(safeOutboundFetch("https://user:password@8.8.8.8/")).rejects.toMatchObject({
      reason: "BLOCKED_PROTOCOL",
    });
    expect(mocks.request).not.toHaveBeenCalled();
  });
});

describe("F06 bounded native transport", () => {
  it("ignores non-fetch caller options that would override the transport", async () => {
    const maliciousInit = {
      method: "POST",
      body: "body",
      agent: {},
      lookup: vi.fn(),
      servername: "internal",
      rejectUnauthorized: false,
      socketPath: "private.sock",
    };
    await safeOutboundFetch("https://hooks.example.test/", maliciousInit);
    const options = mocks.request.mock.calls[0]?.[1] as HttpsOptions;
    expect(options.agent).toBe(false);
    expect(options.rejectUnauthorized).toBe(true);
    expect(options.servername).toBe("hooks.example.test");
    expect(options.socketPath).toBeUndefined();
    expect(options.lookup).not.toBe(maliciousInit.lookup);
  });
  it.each([
    "connection",
    "content-length",
    "transfer-encoding",
    "proxy-authorization",
    "upgrade",
    "expect",
  ])("rejects routing/framing header %s", async (header) => {
    await expect(
      safeOutboundFetch("https://8.8.8.8/", { headers: { [header]: "malicious" } }),
    ).rejects.toMatchObject({ reason: "BLOCKED_HEADERS" });
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("cleans up when the caller cancels during body consumption", async () => {
    const controller = new AbortController();
    connection.end.mockImplementation(() => {
      queueMicrotask(() => controller.abort());
    });
    await expect(
      safeOutboundFetch("https://8.8.8.8/", { signal: controller.signal }),
    ).rejects.toMatchObject({ reason: "REQUEST_ABORTED" });
    expect(connection.destroy).toHaveBeenCalled();
  });
  it("bounds a stalled streaming upload before opening a socket", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const body = new ReadableStream({ cancel });
    const init = { method: "POST", body, duplex: "half" };
    const result = expect(safeOutboundFetch("https://8.8.8.8/", init)).rejects.toMatchObject({
      reason: "REQUEST_TIMEOUT",
    });
    await vi.advanceTimersByTimeAsync(15_001);
    await result;
    expect(cancel).toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("closes the connection after buffering an early successful response", async () => {
    await safeOutboundFetch("https://8.8.8.8/", { method: "POST", body: "payload" });
    expect(connection.destroy).toHaveBeenCalled();
  });
  it.each([301, 302, 303, 307, 308])("rejects redirect %i and closes its body", async (status) => {
    reply.statusCode = status;
    reply.headers = { location: "http://169.254.169.254/" };
    await expect(
      safeOutboundFetch("https://8.8.8.8/", { redirect: "follow" }),
    ).rejects.toMatchObject({ reason: "BLOCKED_REDIRECT" });
    expect(reply.destroyed).toBe(true);
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it("rejects Host overrides rather than letting HTTP authority diverge", async () => {
    await expect(
      safeOutboundFetch("https://8.8.8.8/", { headers: { host: "internal.service" } }),
    ).rejects.toMatchObject({ reason: "BLOCKED_HEADERS" });
  });
  it("enforces response size on a chunked body without Content-Length", async () => {
    connection.end.mockImplementation(() => {
      queueMicrotask(() => reply.end(Buffer.alloc(1024 * 1024 + 1)));
    });
    await expect(safeOutboundFetch("https://8.8.8.8/")).rejects.toMatchObject({
      reason: "RESPONSE_TOO_LARGE",
    });
    expect(reply.destroyed).toBe(true);
  });
  it("rejects compressed bodies even when the peer ignores identity encoding", async () => {
    reply.headers = { "content-encoding": "gzip" };
    await expect(safeOutboundFetch("https://8.8.8.8/")).rejects.toMatchObject({
      reason: "BLOCKED_ENCODING",
    });
  });
  it("rejects oversized request bodies before a socket is opened", async () => {
    await expect(
      safeOutboundFetch("https://8.8.8.8/", { method: "POST", body: "x".repeat(1024 * 1024 + 1) }),
    ).rejects.toMatchObject({ reason: "REQUEST_TOO_LARGE" });
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("deadline covers DNS and a late DNS answer cannot start a request", async () => {
    vi.useFakeTimers();
    let complete!: (value: unknown) => void;
    mocks.lookup.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const promise = safeOutboundFetch("https://hooks.example.test/");
    const result = expect(promise).rejects.toMatchObject({ reason: "REQUEST_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(15_001);
    await result;
    complete([{ address: "8.8.8.8", family: 4 }]);
    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("deadline covers a body that never finishes", async () => {
    vi.useFakeTimers();
    connection.end.mockImplementation(() => {});
    const result = expect(safeOutboundFetch("https://8.8.8.8/")).rejects.toMatchObject({
      reason: "REQUEST_TIMEOUT",
    });
    await vi.advanceTimersByTimeAsync(15_001);
    await result;
    expect(connection.destroy).toHaveBeenCalled();
  });
  it("honors cancellation before DNS or network work", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      safeOutboundFetch("https://hooks.example.test/", { signal: controller.signal }),
    ).rejects.toBeInstanceOf(Error);
    expect(mocks.lookup).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
  });
});
