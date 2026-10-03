import { expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({ loads: 0 }));
vi.mock("zod", async (original) => {
  runtime.loads += 1;
  return original();
});

it("round-trips all assessment response types without loading author validation", async () => {
  const ui = await import("../../../frontend/packages/contracts/src/item-registry/answer-ui");
  expect(runtime.loads).toBe(0);
  const answers: Record<string, Record<string, unknown>> = {
    mcq_single: { selectedOptionId: "option-a" },
    mcq_multi: { selectedOptionIds: ["option-a", "option-b"] },
    true_false: { value: false },
    fill_blank: { value: "answer" },
    short_answer: { value: "short" },
    long_answer: { value: "long" },
    matching: { pairs: { a: "b" } },
    ordering: { order: ["b", "a"] },
    file_upload: { fileName: "answer.pdf" },
    swipe: { action: "unknown" },
  };
  for (const [type, answer] of Object.entries(answers)) {
    expect(ui.responseToWire(ui.responseFromWire(type, answer))).toEqual(answer);
    expect(ui.responseToWire(ui.emptyResponseState(type))).toBeNull();
  }
  expect(ui.responseFromWire("mcq_multi", { selectedOptionIds: [12, "valid", null] })).toEqual({
    type: "mcq_multi",
    selectedOptionIds: ["valid"],
  });
  expect(ui.buildPreviewOptions("mcq_single", {})).toHaveLength(4);
});
