import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isFromPackageFrame,
  parseScormBridgeMessage,
  ScormSaveQueue,
  type ScormSave,
} from "../../../frontend/apps/web/src/features/courses/scorm-bridge";

const LAUNCH = "launch_0123456789abcdef";

/** Cross-origin windows expose `parent`; that is all the frame check may rely on. */
function frameTree() {
  const top = {} as Window & { parent: Window };
  top.parent = top;
  const packageFrame = { parent: top } as unknown as Window;
  const nested = { parent: packageFrame } as unknown as Window;
  const deeplyNested = { parent: nested } as unknown as Window;
  const sibling = { parent: top } as unknown as Window;
  return { top, packageFrame, nested, deeplyNested, sibling };
}

describe("isFromPackageFrame", () => {
  it("accepts the package iframe and frames nested inside it", () => {
    const { packageFrame, nested, deeplyNested } = frameTree();
    expect(isFromPackageFrame(packageFrame, packageFrame)).toBe(true);
    expect(isFromPackageFrame(nested, packageFrame)).toBe(true);
    expect(isFromPackageFrame(deeplyNested, packageFrame)).toBe(true);
  });

  it("rejects everything else", () => {
    const { top, packageFrame, sibling } = frameTree();
    expect(isFromPackageFrame(top, packageFrame)).toBe(false);
    expect(isFromPackageFrame(sibling, packageFrame)).toBe(false);
    expect(isFromPackageFrame(null, packageFrame)).toBe(false);
    expect(isFromPackageFrame(packageFrame, null)).toBe(false);
    const throwing = {
      get parent(): Window {
        throw new Error("blocked");
      },
    };
    expect(isFromPackageFrame(throwing, packageFrame)).toBe(false);
  });

  it("gives up beyond a bounded depth", () => {
    const { packageFrame } = frameTree();
    let deep = packageFrame;
    for (let index = 0; index < 20; index += 1) deep = { parent: deep } as unknown as Window;
    expect(isFromPackageFrame(deep, packageFrame)).toBe(false);
  });
});

describe("parseScormBridgeMessage", () => {
  const message = (overrides: Record<string, unknown> = {}) => ({
    protocol: "atlas-scorm",
    version: 1,
    launchId: LAUNCH,
    type: "commit",
    values: { "cmi.location": "p2", "adl.nav.request": "continue" },
    ...overrides,
  });

  it("accepts this launch's protocol", () => {
    expect(parseScormBridgeMessage(message(), LAUNCH)).toEqual({
      type: "commit",
      values: { "cmi.location": "p2", "adl.nav.request": "continue" },
    });
    expect(parseScormBridgeMessage(message({ type: "hello", values: undefined }), LAUNCH)).toEqual({
      type: "hello",
      values: null,
    });
  });

  it.each([
    ["another launch", { launchId: "launch_other_000000000" }],
    ["another protocol", { protocol: "scorm-again" }],
    ["another version", { version: 2 }],
    ["an unknown type", { type: "navigate" }],
    ["values that are not an object", { values: ["cmi.location"] }],
    ["a non-data-model key", { values: { "atlas.total_time_seconds": "999999" } }],
    ["an arbitrary key", { values: { __proto__x: "1" } }],
    ["a non-string value", { values: { "cmi.location": 5 } }],
    ["an oversized value", { values: { "cmi.suspend_data": "x".repeat(64_001) } }],
  ])("rejects %s", (_label, overrides) => {
    expect(parseScormBridgeMessage(message(overrides), LAUNCH)).toBeNull();
  });

  it("rejects non-objects and oversized documents", () => {
    expect(parseScormBridgeMessage("commit", LAUNCH)).toBeNull();
    expect(parseScormBridgeMessage(null, LAUNCH)).toBeNull();
    const huge = Object.fromEntries(
      Array.from({ length: 20 }, (_, index) => [`cmi.k${String(index)}`, "x".repeat(60_000)]),
    );
    expect(parseScormBridgeMessage(message({ values: huge }), LAUNCH)).toBeNull();
  });
});

describe("ScormSaveQueue", () => {
  let sent: ScormSave[];
  let resolvers: Array<(failure?: Error) => void>;

  beforeEach(() => {
    vi.useFakeTimers();
    sent = [];
    resolvers = [];
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function queue(onError = vi.fn()) {
    return new ScormSaveQueue(
      (save) => {
        sent.push(save);
        return new Promise<void>((resolve, reject) => {
          resolvers.push((failure) => (failure ? reject(failure) : resolve()));
        });
      },
      // Fake timers drive Date.now, which the queue reads by default.
      { minIntervalMs: 2_000, onError },
    );
  }
  async function advance(ms: number) {
    await vi.advanceTimersByTimeAsync(ms);
  }

  it("keeps one save in flight and merges what arrives meanwhile", async () => {
    const saves = queue();
    saves.enqueue({ cmi: { "cmi.location": "1" }, terminated: false });
    await advance(0);
    expect(sent).toHaveLength(1);
    saves.enqueue({ cmi: { "cmi.location": "2", "cmi.score.raw": "50" }, terminated: false });
    saves.enqueue({ cmi: { "cmi.location": "3" }, terminated: false });
    await advance(5_000);
    expect(sent).toHaveLength(1);
    resolvers[0]?.();
    await advance(0);
    expect(sent).toEqual([
      { cmi: { "cmi.location": "1" }, terminated: false },
      { cmi: { "cmi.location": "3", "cmi.score.raw": "50" }, terminated: false },
    ]);
  });

  it("spaces saves by the minimum interval", async () => {
    const saves = queue();
    saves.enqueue({ cmi: { a: "1" }, terminated: false });
    await advance(0);
    resolvers[0]?.();
    saves.enqueue({ cmi: { a: "2" }, terminated: false });
    await advance(1_999);
    expect(sent).toHaveLength(1);
    await advance(1);
    expect(sent).toHaveLength(2);
  });

  it("sends a terminate without waiting out the interval, and never merges it away", async () => {
    const saves = queue();
    saves.enqueue({ cmi: { a: "1" }, terminated: false });
    await advance(0);
    resolvers[0]?.();
    await advance(0);
    saves.enqueue({ cmi: { a: "2" }, terminated: true });
    saves.enqueue({ cmi: { a: "3" }, terminated: false });
    await advance(0);
    expect(sent.at(-1)).toEqual({ cmi: { a: "3" }, terminated: true });
  });

  it("keeps failed data under anything newer, reports, and backs off", async () => {
    const onError = vi.fn();
    const saves = queue(onError);
    saves.enqueue({ cmi: { a: "1", b: "1" }, terminated: true });
    await advance(0);
    saves.enqueue({ cmi: { b: "2" }, terminated: false });
    resolvers[0]?.(new Error("offline"));
    await advance(0);
    expect(onError).toHaveBeenCalledTimes(1);
    await advance(3_999);
    expect(sent).toHaveLength(1);
    await advance(1);
    expect(sent[1]).toEqual({ cmi: { a: "1", b: "2" }, terminated: true });
  });

  it("hands over unsent data for a last-chance save, and stops after dispose", async () => {
    const saves = queue();
    saves.enqueue({ cmi: { a: "1" }, terminated: false });
    await advance(0);
    saves.enqueue({ cmi: { a: "2" }, terminated: false });
    expect(saves.takePending()).toEqual({ cmi: { a: "2" }, terminated: false });
    expect(saves.takePending()).toBeNull();
    saves.dispose();
    saves.enqueue({ cmi: { a: "3" }, terminated: false });
    resolvers[0]?.();
    await advance(10_000);
    expect(sent).toHaveLength(1);
  });
});
