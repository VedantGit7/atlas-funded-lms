// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "../../../frontend/apps/web/node_modules/react";
import { createRoot, type Root } from "../../../frontend/apps/web/node_modules/react-dom/client";

const { mockPost, mockPush, mockRefresh } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

vi.mock("../../../frontend/apps/web/src/lib/client-api", () => ({
  clientApi: { post: mockPost },
  ClientApiError: class ClientApiError extends Error {},
}));

vi.mock("../../../frontend/apps/web/src/observability/capture-product-event", () => ({
  captureProductEvent: vi.fn(),
}));

vi.mock(
  "../../../frontend/apps/web/src/features/assessments/lib/proctoring-signal-capture",
  () => ({
    attachProctoringSignalCapture: () => () => undefined,
    submitFixtureIdentityVerification: vi.fn(),
  }),
);

vi.mock(
  "../../../frontend/apps/web/src/features/item-registry/components/renderers/item-response-renderer",
  async () => {
    const react = await import("../../../frontend/apps/web/node_modules/react");
    return {
      ItemResponseRenderer: (props: {
        disabled?: boolean;
        onAnswerChange: (answer: Record<string, unknown>) => void;
      }) =>
        react.createElement(
          "button",
          {
            type: "button",
            "data-testid": "answer",
            "data-disabled": String(Boolean(props.disabled)),
            onClick: () => props.onAnswerChange({ selectedOptionId: "opt-1" }),
          },
          "answer",
        ),
    };
  },
);

import { AttemptRunner } from "../../../frontend/apps/web/src/features/assessments/components/attempt-runner";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const attemptId = "018f0000-0000-7000-8000-000000000040";
const submitPath = `/api/v1/attempts/${attemptId}/submit`;
const answersPath = `/api/v1/attempts/${attemptId}/answers`;

let container: HTMLDivElement;
let root: Root;

function render(dueInMs: number) {
  const now = Date.now();
  const initialAttempt = {
    id: attemptId,
    assessmentId: "018f0000-0000-7000-8000-000000000030",
    status: "STARTED",
    startedAt: new Date(now - 60_000).toISOString(),
    submittedAt: null,
    dueAt: new Date(now + dueInMs).toISOString(),
    serverNow: new Date(now).toISOString(),
    secureMode: false,
    proctoringLevel: 0,
    l1ProctoringEnabled: false,
    passMarkPercent: 50,
    items: [
      {
        id: "item-1",
        assessmentItemId: "ai-1",
        itemId: "item-1",
        itemTypeKey: "mcq_single",
        position: 1,
        points: 1,
        required: false,
        contentJson: { stem: "2 + 2?" },
        options: [],
        savedAnswer: null,
      },
    ],
  };
  act(() => {
    root.render(createElement(AttemptRunner, { initialAttempt } as never));
  });
}

function timerText() {
  return /Time remaining: (\d\d:\d\d)/.exec(container.textContent ?? "")?.[1];
}

function submitCalls() {
  return mockPost.mock.calls.filter((call) => call[0] === submitPath);
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01T10:00:00.000Z"));
  mockPost.mockReset();
  mockPush.mockReset();
  mockRefresh.mockReset();
  mockPost.mockResolvedValue({ data: {} });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("counts down every second (it used to stay frozen at the load-time value)", async () => {
  render(10_000);
  expect(timerText()).toBe("00:10");

  await advance(1_000);
  expect(timerText()).toBe("00:09");

  await advance(3_000);
  expect(timerText()).toBe("00:06");
});

it("auto-submits at 00:00 without asking for confirmation", async () => {
  const confirm = vi.spyOn(window, "confirm");
  render(3_000);
  expect(submitCalls()).toHaveLength(0);

  await advance(3_000);

  expect(submitCalls()).toHaveLength(1);
  expect(confirm).not.toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith(`/attempts/${attemptId}/result`);
  expect(container.textContent).toContain("Time is up");
});

it("submits only once even as the clock keeps ticking past 00:00", async () => {
  render(1_000);
  await advance(10_000);
  expect(submitCalls()).toHaveLength(1);
});

it("waits for an autosave that is in flight at 00:00 before submitting", async () => {
  let resolveSave: (() => void) | undefined;
  mockPost.mockImplementation((path: string) =>
    path === answersPath
      ? new Promise<void>((resolve) => {
          resolveSave = resolve;
        })
      : Promise.resolve({ data: {} }),
  );
  render(2_000);

  act(() => {
    container.querySelector<HTMLButtonElement>('[data-testid="answer"]')?.click();
  });
  await advance(2_000);
  expect(submitCalls()).toHaveLength(0);

  await act(async () => {
    resolveSave?.();
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(submitCalls()).toHaveLength(1);
});

it("does not wait forever for a stuck autosave", async () => {
  mockPost.mockImplementation((path: string) =>
    path === answersPath ? new Promise(() => undefined) : Promise.resolve({ data: {} }),
  );
  render(1_000);
  act(() => {
    container.querySelector<HTMLButtonElement>('[data-testid="answer"]')?.click();
  });

  await advance(1_000);
  expect(submitCalls()).toHaveLength(0);

  await advance(5_000);
  expect(submitCalls()).toHaveLength(1);
});

it("locks answers once time is up", async () => {
  mockPost.mockImplementation((path: string) =>
    path === submitPath ? new Promise(() => undefined) : Promise.resolve({ data: {} }),
  );
  render(1_000);
  await advance(1_000);

  const answer = container.querySelector<HTMLButtonElement>('[data-testid="answer"]');
  expect(answer?.dataset["disabled"]).toBe("true");
  act(() => {
    answer?.click();
  });
  expect(mockPost.mock.calls.filter((call) => call[0] === answersPath)).toHaveLength(0);
});
