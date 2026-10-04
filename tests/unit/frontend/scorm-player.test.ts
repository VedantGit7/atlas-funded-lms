// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "../../../frontend/apps/web/node_modules/react";
import { createRoot, type Root } from "../../../frontend/apps/web/node_modules/react-dom/client";

const { mockGet, mockPut } = vi.hoisted(() => ({ mockGet: vi.fn(), mockPut: vi.fn() }));

vi.mock("../../../frontend/apps/web/src/lib/client-api", () => ({
  clientApi: { get: mockGet, put: mockPut },
  ClientApiError: class ClientApiError extends Error {},
  createClientUuid: () => "uuid",
}));

import { ScormPlayer } from "../../../frontend/apps/web/src/features/courses/scorm-player";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const launch = {
  moduleId: "018f0000-0000-7000-8000-000000000030",
  courseId: "018f0000-0000-7000-8000-000000000031",
  title: "Interactive chapter",
  scormVersion: "2004" as const,
  launchPath: "index.html",
  contentUrl: "/api/v1/public/scorm/k1.payload.signature/index.html",
  launchId: "launch_0123456789abcdef",
  progress: { status: "not_started" as const, progressPct: 0, completedAt: null },
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  mockGet.mockResolvedValue({ data: { status: "not_started", cmi: {} } });
  mockPut.mockResolvedValue({
    data: { status: "completed", cmi: { "cmi.completion_status": "completed" } },
  });
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
  vi.clearAllMocks();
});

async function render() {
  await act(async () => {
    root.render(createElement(ScormPlayer, { launch }));
    await Promise.resolve();
  });
  const iframe = container.querySelector("iframe");
  if (!iframe) throw new Error("no iframe");
  return iframe;
}

function post(source: unknown, data: Record<string, unknown>) {
  window.dispatchEvent(
    new MessageEvent("message", { data, origin: "null", source: source as Window }),
  );
}
const bridge = (type: string, values?: Record<string, string>) => ({
  protocol: "atlas-scorm",
  version: 1,
  launchId: launch.launchId,
  type,
  ...(values ? { values } : {}),
});

it("sandboxes the package without same-origin and loads it once the bridge is listening", async () => {
  const iframe = await render();
  expect(iframe.getAttribute("sandbox")).toBe("allow-scripts allow-forms allow-popups");
  expect(iframe.getAttribute("sandbox")).not.toContain("allow-same-origin");
  expect(iframe.getAttribute("src")).toBe(launch.contentUrl);
});

it("saves commits silently, throttled, and only from inside its own iframe", async () => {
  const iframe = await render();
  const packageWindow = iframe.contentWindow;

  await act(async () => {
    post(window, bridge("commit", { "cmi.location": "spoofed" }));
    post(packageWindow, {
      ...bridge("commit", { "cmi.location": "x" }),
      launchId: "launch_other_000000000",
    });
    post(packageWindow, bridge("commit", { "cmi.location": "p1" }));
    post(packageWindow, bridge("commit", { "cmi.location": "p2" }));
    await vi.advanceTimersByTimeAsync(0);
  });
  // Both commits arrived before the first save went out: one save, newest value.
  expect(mockPut).toHaveBeenCalledTimes(1);
  expect(mockPut).toHaveBeenCalledWith(
    `/api/v1/modules/${launch.moduleId}/scorm-progress`,
    { cmi: { "cmi.location": "p2" } },
    "module-scorm-progress",
    { silent: true },
  );

  await act(async () => {
    post(packageWindow, bridge("terminate", { "cmi.completion_status": "completed" }));
    await vi.advanceTimersByTimeAsync(2_000);
  });
  expect(mockPut).toHaveBeenLastCalledWith(
    expect.any(String),
    { cmi: { "cmi.completion_status": "completed" }, terminated: true },
    "module-scorm-progress",
    { silent: true },
  );
  expect(container.textContent).toContain("Status: completed");
});

it("answers a document's hello with the latest saved data, and shows save failures", async () => {
  mockGet.mockResolvedValue({
    data: { status: "in_progress", cmi: { "cmi.location": "p4", "cmi.score.raw": 80 } },
  });
  const iframe = await render();
  const packageWindow = iframe.contentWindow;
  if (!packageWindow) throw new Error("no window");
  const reply = vi.spyOn(packageWindow, "postMessage");

  await act(async () => {
    post(packageWindow, bridge("hello"));
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(reply).toHaveBeenCalledWith(
    {
      protocol: "atlas-scorm-player",
      version: 1,
      launchId: launch.launchId,
      type: "state",
      values: { "cmi.location": "p4", "cmi.score.raw": "80" },
    },
    "*",
  );

  mockPut.mockRejectedValueOnce(new Error("offline"));
  await act(async () => {
    post(packageWindow, bridge("commit", { "cmi.location": "p5" }));
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("could not be saved");
});
