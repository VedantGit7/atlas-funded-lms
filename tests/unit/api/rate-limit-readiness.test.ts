import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RedisRateLimitStore, type RateLimitRedisClient } from "@atlas/api/rate-limit-store";

class ConnectingClient extends EventEmitter implements RateLimitRedisClient {
  status = "connecting";
  eval = vi.fn(async () => [1, 60000]);
  quit = vi.fn(async () => "OK");
  ready() {
    this.status = "ready";
    this.emit("ready");
  }
}

afterEach(() => vi.useRealTimers());

describe("Redis rate-limit connection readiness", () => {
  it("waits for ready before sending a cold hit, sharing one wait across concurrent requests", async () => {
    const client = new ConnectingClient();
    const store = new RedisRateLimitStore(client);
    const pending = Promise.all(Array.from({ length: 20 }, () => store.hit("cold", 60000)));
    expect(client.eval).not.toHaveBeenCalled();
    expect(client.listenerCount("ready")).toBe(1);
    client.ready();
    const hits = await pending;
    expect(hits).toHaveLength(20);
    expect(client.eval).toHaveBeenCalledTimes(20);
    for (const event of ["ready", "error", "end"]) expect(client.listenerCount(event)).toBe(0);
  });

  it("fails closed after two seconds without issuing a command, then can recover", async () => {
    vi.useFakeTimers();
    const client = new ConnectingClient();
    const store = new RedisRateLimitStore(client);
    const failed = expect(store.hit("cold", 60000)).rejects.toThrow(
      "Redis rate-limit connection unavailable",
    );
    await vi.advanceTimersByTimeAsync(1999);
    expect(client.eval).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await failed;
    for (const event of ["ready", "error", "end"]) expect(client.listenerCount(event)).toBe(0);
    const recovered = store.hit("cold", 60000);
    client.ready();
    await expect(recovered).resolves.toMatchObject({ count: 1 });
    expect(client.eval).toHaveBeenCalledTimes(1);
  });

  it.each(["error", "end"])(
    "rejects %s while connecting without exposing connection details",
    async (event) => {
      const client = new ConnectingClient();
      client.on("error", () => {});
      const store = new RedisRateLimitStore(client);
      const failed = expect(store.hit("cold", 60000)).rejects.toThrow(
        "Redis rate-limit connection unavailable",
      );
      client.emit(event, new Error("redis://private-credential@example.test"));
      await failed;
      expect(client.eval).not.toHaveBeenCalled();
      expect(client.listenerCount("ready")).toBe(0);
      expect(client.listenerCount("end")).toBe(0);
      expect(client.listenerCount("error")).toBe(1);
    },
  );

  it("rechecks readiness after a previously healthy connection disconnects", async () => {
    const client = new ConnectingClient();
    client.ready();
    const store = new RedisRateLimitStore(client);
    await store.hit("hot", 60000);
    client.status = "reconnecting";
    const hit = store.hit("reconnect", 60000);
    expect(client.eval).toHaveBeenCalledTimes(1);
    client.ready();
    await hit;
    expect(client.eval).toHaveBeenCalledTimes(2);
  });
});
