// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "../../../frontend/apps/web/node_modules/react";
import { createRoot, type Root } from "../../../frontend/apps/web/node_modules/react-dom/client";

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));

vi.mock("../../../frontend/apps/web/src/lib/client-api", () => ({
  clientApi: { post: mockPost },
  ClientApiError: class ClientApiError extends Error {},
}));

vi.mock("../../../frontend/apps/web/src/observability/capture-product-event", () => ({
  captureProductEvent: vi.fn(),
}));

import {
  LessonProgressProvider,
  type LessonProgressState,
} from "../../../frontend/apps/web/src/features/lessons/lesson-progress-context";
import { LessonProgressPanel } from "../../../frontend/apps/web/src/features/lessons/lesson-progress-panel";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const lessonA = "018f0000-0000-7000-8000-0000000000a1";
const lessonB = "018f0000-0000-7000-8000-0000000000b2";

function progress(overrides: Partial<LessonProgressState> = {}): LessonProgressState {
  return {
    status: "not_started",
    progressPct: 0,
    positionSeconds: null,
    completedAt: null,
    lastSeenAt: null,
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root;

function render(lessonId: string, initial: LessonProgressState) {
  act(() => {
    root.render(
      createElement(
        LessonProgressProvider,
        { key: lessonId, lessonId, initialProgress: initial },
        createElement(LessonProgressPanel),
      ),
    );
  });
}

async function runFor(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  // The server answers like the real route: the position moves, so the old
  // panel scheduled another save after every one.
  let position = 0;
  mockPost.mockReset();
  mockPost.mockImplementation((_path: string, body: { positionSeconds: number }) => {
    position = body.positionSeconds + 1;
    return Promise.resolve({
      data: progress({
        status: "in_progress",
        progressPct: 1,
        positionSeconds: position,
        lastSeenAt: new Date().toISOString(),
      }),
    });
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

// Launch plan 5.1 (staging, 6 November 2026): an open lesson wrote progress
// every ~1.75 s, forever, each time with a position 30 s further on.
it("saves once when a lesson opens, keeping its position, and never loops", async () => {
  render(lessonA, progress({ status: "in_progress", positionSeconds: 120 }));
  await runFor(60_000);

  expect(mockPost).toHaveBeenCalledTimes(1);
  expect(mockPost).toHaveBeenCalledWith(
    `/api/v1/lessons/${lessonA}/progress`,
    { positionSeconds: 120, completed: false },
    `lesson-progress-${lessonA}`,
  );
});

it("marks a new lesson in progress with a single save", async () => {
  render(lessonA, progress());
  await runFor(60_000);

  expect(mockPost).toHaveBeenCalledTimes(1);
  expect(mockPost.mock.calls[0]?.[1]).toEqual({ positionSeconds: 0, completed: false });
});

it("doesn't save a completed lesson", async () => {
  render(lessonA, progress({ status: "completed", progressPct: 100, positionSeconds: 300 }));
  await runFor(60_000);

  expect(mockPost).not.toHaveBeenCalled();
});

it("saves once more when the learner opens another lesson", async () => {
  render(lessonA, progress({ status: "in_progress", positionSeconds: 10 }));
  await runFor(10_000);
  render(lessonB, progress());
  await runFor(10_000);

  expect(mockPost).toHaveBeenCalledTimes(2);
  expect(mockPost.mock.calls[1]?.[0]).toBe(`/api/v1/lessons/${lessonB}/progress`);
});
