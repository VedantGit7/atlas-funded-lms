import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertNoHeldConnection,
  holdingConnection,
  NestedConnectionError,
} from "../../../backend/packages/db/src/connection-scope";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("connection scope (audit H3)", () => {
  it("allows a connection when none is held, and sequential connections", async () => {
    expect(() => {
      assertNoHeldConnection("withGlobalDb");
    }).not.toThrow();
    await holdingConnection("withGlobalDb", async () => "tenant");
    expect(() => {
      assertNoHeldConnection("withTenantTx");
    }).not.toThrow();
  });

  it("refuses a second connection while one is held, outside deployed runtimes", async () => {
    await expect(
      holdingConnection("withGlobalDb", async () => {
        await Promise.resolve();
        assertNoHeldConnection("withTenantTx");
      }),
    ).rejects.toThrow(NestedConnectionError);
    await expect(
      holdingConnection("withGlobalDb", async () => {
        assertNoHeldConnection("withTenantTx");
      }),
    ).rejects.toThrow(/withTenantTx was called while withGlobalDb still holds a pooled connection/);
  });

  it("sees through helper functions, which a lexical check cannot", async () => {
    const helperThatOpensItsOwn = async () => {
      await Promise.resolve();
      assertNoHeldConnection("withTenantTx");
    };
    await expect(holdingConnection("withGlobalDb", helperThatOpensItsOwn)).rejects.toThrow(
      NestedConnectionError,
    );
  });

  it("does not blame work that outlives the holder", async () => {
    let detached: Promise<void> = Promise.resolve();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await holdingConnection("withGlobalDb", async () => {
      detached = gate.then(() => {
        assertNoHeldConnection("withTenantTx");
      });
    });
    release();
    await expect(detached).resolves.toBeUndefined();
  });

  it("logs instead of failing in production, at most once a minute per pair", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (let index = 0; index < 3; index += 1) {
      await holdingConnection("withGlobalDb", async () => {
        assertNoHeldConnection("withTenantTx");
      });
    }
    expect(error).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(String(error.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(logged).toMatchObject({
      level: "error",
      event: "db.nested_connection",
      outer: "withGlobalDb",
      inner: "withTenantTx",
    });
  });
});
