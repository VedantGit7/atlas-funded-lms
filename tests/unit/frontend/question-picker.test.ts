// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../../frontend/apps/web/node_modules/react";
import { createRoot, type Root } from "../../../frontend/apps/web/node_modules/react-dom/client";
import { renderToStaticMarkup } from "../../../frontend/apps/web/node_modules/react-dom/server.node.js";

/**
 * S1.4 on the author's side (QA review 1 C8, M51; review 2 C6): the shared
 * question picker searches the whole bank, shows real question text and type
 * names, pages, and adds several at once; a collection says what keeps its
 * questions from learners.
 */

const { mockListItems } = vi.hoisted(() => ({ mockListItems: vi.fn() }));

vi.mock("../../../frontend/apps/web/src/features/item-registry/api", () => ({
  itemRegistryApi: { listItems: mockListItems },
  formatItemRegistryApiError: (error: unknown) => String(error),
}));

const { QuestionPickerDialog } =
  await import("../../../frontend/apps/web/src/features/item-registry/components/question-picker-dialog");
const { CollectionNotices } =
  await import("../../../frontend/apps/web/src/features/item-registry/components/item-collections-table");

function item(index: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    itemTypeKey: "mcq_single",
    contentJson: { stem: `Question ${String(index)}` },
    answerKeyJson: null,
    status: "PUBLISHED",
    tags: ["candles"],
    metadataJson: null,
    createdByMembershipId: null,
    createdAt: "2026-11-23T00:00:00.000Z",
    updatedAt: "2026-11-23T00:00:00.000Z",
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root;

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
}

beforeEach(() => {
  mockListItems.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("question picker", () => {
  it("shows real question text and type names, the total, and adds the ticked ones", async () => {
    mockListItems.mockResolvedValue({
      data: [item(1), item(2, { itemTypeKey: "true_false", status: "DRAFT" }), item(3)],
      page: { total: 612, hasMore: true, nextCursor: "next" },
    });
    const onConfirm = vi.fn();
    act(() => {
      root.render(
        createElement(QuestionPickerDialog, {
          open: true,
          title: "Add questions to this quiz",
          addedIds: new Set([item(3).id]),
          onCancel: vi.fn(),
          onConfirm,
        }),
      );
    });
    await flush();

    const text = container.textContent ?? "";
    expect(text).toContain("Question 1");
    expect(text).toContain("Multiple choice (single)");
    expect(text).toContain("True / False");
    expect(text).toContain("Draft");
    expect(text).toContain("Showing 3 of 612 questions");
    expect(text).toContain("Already added");
    expect(text).not.toContain("mcq_single");
    expect(mockListItems).toHaveBeenCalledWith({ limit: 50 });

    const boxes = [...container.querySelectorAll<HTMLInputElement>('li input[type="checkbox"]')];
    expect(boxes[2]?.disabled).toBe(true);
    act(() => {
      boxes[0]?.click();
      boxes[1]?.click();
    });
    expect(container.textContent).toContain("2 selected");

    const add = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Add 2 questions"),
    );
    act(() => {
      add?.click();
    });
    expect(onConfirm).toHaveBeenCalledWith([
      item(1),
      item(2, { itemTypeKey: "true_false", status: "DRAFT" }),
    ]);
  });

  it("searches the bank and loads the next page", async () => {
    mockListItems.mockResolvedValue({
      data: [item(1)],
      page: { total: 2, hasMore: true, nextCursor: "cursor-1" },
    });
    act(() => {
      root.render(
        createElement(QuestionPickerDialog, {
          open: true,
          title: "Add",
          addedIds: new Set<string>(),
          onCancel: vi.fn(),
          onConfirm: vi.fn(),
        }),
      );
    });
    await flush();

    mockListItems.mockResolvedValue({
      data: [item(2)],
      page: { total: 2, hasMore: false, nextCursor: null },
    });
    const more = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Show 50 more"),
    );
    act(() => {
      more?.click();
    });
    await flush();
    expect(mockListItems).toHaveBeenLastCalledWith({ limit: 50, cursor: "cursor-1" });
    expect(container.textContent).toContain("Question 2");
    expect(container.textContent).toContain("Showing 2 of 2 questions");

    const search = container.querySelector<HTMLInputElement>('input[type="search"]');
    act(() => {
      if (!search) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(search, "engulfing");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await flush();
    expect(mockListItems).toHaveBeenLastCalledWith({ limit: 50, q: "engulfing" });
  });
});

describe("collection notices", () => {
  const entry = (itemTypeKey: string, status: string) => ({
    id: crypto.randomUUID(),
    collectionId: crypto.randomUUID(),
    itemId: crypto.randomUUID(),
    position: 1,
    weight: null,
    item: { stem: "Q", itemTypeKey, status },
  });

  it("offers to publish draft questions and says which types Practice skips", () => {
    const html = renderToStaticMarkup(
      createElement(CollectionNotices, {
        collectionType: "deck",
        entries: [
          entry("swipe", "DRAFT"),
          entry("swipe", "DRAFT"),
          entry("long_answer", "PUBLISHED"),
        ],
        pending: false,
        onPublishDrafts: vi.fn(),
      }),
    );
    expect(html).toContain("2 questions are");
    expect(html).toContain("Learners only see published questions.");
    expect(html).toContain("Publish these 2");
    expect(html).toContain("1 question");
    expect(html).toContain("show in Practice");
  });

  it("says nothing when every question reaches learners", () => {
    expect(
      renderToStaticMarkup(
        createElement(CollectionNotices, {
          collectionType: "deck",
          entries: [entry("swipe", "PUBLISHED"), entry("mcq_single", "PUBLISHED")],
          pending: false,
          onPublishDrafts: vi.fn(),
        }),
      ),
    ).toBe("");
    // Practice types only matter for decks.
    expect(
      renderToStaticMarkup(
        createElement(CollectionNotices, {
          collectionType: "quiz_bank",
          entries: [entry("long_answer", "PUBLISHED")],
          pending: false,
          onPublishDrafts: vi.fn(),
        }),
      ),
    ).toBe("");
  });
});
