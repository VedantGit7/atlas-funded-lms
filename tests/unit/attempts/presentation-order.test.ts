import { describe, expect, it } from "vitest";
import {
  orderItems,
  orderOptions,
  planPresentationOrder,
  readPresentationOrder,
  secureShuffle,
} from "../../../backend/apps/api/src/server/attempts/presentation-order";

/** Audit M9: an attempt's order is drawn once and reused on every fetch. */

const rows = [
  { id: "item-c", position: 3 },
  { id: "item-a", position: 1 },
  { id: "item-b", position: 2 },
];
const options = [
  { id: "opt-2", position: 2 },
  { id: "opt-1", position: 1 },
  { id: "opt-3", position: 3 },
];

describe("planPresentationOrder", () => {
  it("keeps authored order when nothing is shuffled, and stores it anyway", () => {
    expect(
      planPresentationOrder({
        items: rows.map((row) => ({ ...row, options })),
        shuffleItems: false,
        shuffleOptions: false,
      }),
    ).toEqual({ itemOrder: ["item-a", "item-b", "item-c"], optionOrder: {} });
  });

  it("draws a permutation of every item and of each item's options", () => {
    const order = planPresentationOrder({
      items: rows.map((row) => ({ ...row, options })),
      shuffleItems: true,
      shuffleOptions: true,
    });
    expect([...order.itemOrder].sort()).toEqual(["item-a", "item-b", "item-c"]);
    for (const row of rows) {
      expect([...(order.optionOrder[row.id] ?? [])].sort()).toEqual(["opt-1", "opt-2", "opt-3"]);
    }
  });

  it("actually varies between attempts", () => {
    const seen = new Set(
      Array.from({ length: 50 }, () => secureShuffle(["a", "b", "c", "d", "e"]).join("")),
    );
    expect(seen.size).toBeGreaterThan(5);
  });
});

describe("applying a stored order", () => {
  const order = {
    itemOrder: ["item-b", "item-c", "item-a"],
    optionOrder: { "item-b": ["opt-3", "opt-1", "opt-2"] },
  };

  it("presents items and options exactly as stored, every time", () => {
    const first = orderItems(rows, { order, attemptId: "x", shuffleItems: true });
    const second = orderItems([...rows].reverse(), { order, attemptId: "x", shuffleItems: true });
    expect(first.map((row) => row.id)).toEqual(["item-b", "item-c", "item-a"]);
    expect(second.map((row) => row.id)).toEqual(["item-b", "item-c", "item-a"]);
    expect(
      orderOptions(options, {
        order,
        attemptId: "x",
        assessmentItemId: "item-b",
        shuffleOptions: true,
      }).map((option) => option.id),
    ).toEqual(["opt-3", "opt-1", "opt-2"]);
  });

  it("puts anything added after the attempt started last, by position", () => {
    const withNew = [...rows, { id: "item-new", position: 0 }];
    expect(
      orderItems(withNew, { order, attemptId: "x", shuffleItems: true }).map((row) => row.id),
    ).toEqual(["item-b", "item-c", "item-a", "item-new"]);
  });

  it("keeps authored option order for items the stored order did not shuffle", () => {
    expect(
      orderOptions(options, {
        order,
        attemptId: "x",
        assessmentItemId: "item-a",
        shuffleOptions: true,
      }).map((option) => option.id),
    ).toEqual(["opt-1", "opt-2", "opt-3"]);
  });
});

describe("attempts started before the order was stored", () => {
  it("get an order that is stable across fetches and differs between attempts", () => {
    const fetch = (attemptId: string) =>
      orderItems(rows, { order: undefined, attemptId, shuffleItems: true }).map((row) => row.id);
    expect(fetch("attempt-1")).toEqual(fetch("attempt-1"));
    const orders = new Set(
      Array.from({ length: 20 }, (_, index) => fetch(`attempt-${String(index)}`).join()),
    );
    expect(orders.size).toBeGreaterThan(1);
    expect(
      orderOptions(options, {
        order: undefined,
        attemptId: "attempt-1",
        assessmentItemId: "item-a",
        shuffleOptions: true,
      }),
    ).toEqual(
      orderOptions([...options].reverse(), {
        order: undefined,
        attemptId: "attempt-1",
        assessmentItemId: "item-a",
        shuffleOptions: true,
      }),
    );
  });
});

describe("readPresentationOrder", () => {
  it("reads a stored order and ignores anything malformed", () => {
    expect(readPresentationOrder({ itemOrder: ["a"], optionOrder: { a: ["x"] } })).toEqual({
      itemOrder: ["a"],
      optionOrder: { a: ["x"] },
    });
    expect(readPresentationOrder({ itemOrder: "a" })).toBeUndefined();
    expect(readPresentationOrder(null)).toBeUndefined();
    expect(readPresentationOrder({ itemOrder: ["a"], optionOrder: { a: [1] } })).toEqual({
      itemOrder: ["a"],
      optionOrder: {},
    });
  });
});
