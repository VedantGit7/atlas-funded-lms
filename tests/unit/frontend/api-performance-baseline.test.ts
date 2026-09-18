import { describe, expect, it } from "vitest";

import { parallelLoad } from "../../../frontend/apps/web/src/lib/api/parallel";
import {
  resolveQueryHostScope,
  withQueryHost,
} from "../../../frontend/apps/web/src/lib/api/query-host";
import { queryStaleTimes } from "../../../frontend/apps/web/src/lib/api/query-stale-times";

describe("parallelLoad", () => {
  it("runs independent loaders in parallel and preserves order", async () => {
    const order: number[] = [];

    const [first, second] = await parallelLoad<[string, string]>([
      async () => {
        order.push(1);
        return "a";
      },
      async () => {
        order.push(2);
        return "b";
      },
    ]);

    expect(first).toBe("a");
    expect(second).toBe("b");
    expect(order).toEqual([1, 2]);
  });
});

describe("queryStaleTimes", () => {
  it("matches performance.md baseline tiers", () => {
    expect(queryStaleTimes.meShell).toBe(30_000);
    expect(queryStaleTimes.notifications).toBe(15_000);
    expect(queryStaleTimes.catalogList).toBe(60_000);
    expect(queryStaleTimes.assessmentRunner).toBe(0);
  });
});

describe("withQueryHost", () => {
  it("appends explicit host scope", () => {
    expect(withQueryHost(["atlas", "me"] as const, "acme-academy.localhost.test:3000")).toEqual([
      "atlas",
      "me",
      { host: "acme-academy.localhost.test:3000" },
    ]);
  });

  it("uses server scope when host is omitted on the server", () => {
    expect(resolveQueryHostScope()).toEqual({ host: "server" });
  });
});
