// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../../frontend/apps/web/node_modules/react";
import { createRoot, type Root } from "../../../frontend/apps/web/node_modules/react-dom/client";
// The modern build, which is what the panel's bare import resolves to; the
// package directory resolves to the legacy build, a second context.
import {
  QueryClient,
  QueryClientProvider,
} from "../../../frontend/apps/web/node_modules/@tanstack/react-query/build/modern/index.js";

const { mockGet, mockPost, mockPut, mockRefresh } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mockRefresh }),
  usePathname: () => "/studio/courses/018f0000-0000-7000-8000-000000000071/settings",
}));

vi.mock("../../../frontend/apps/web/src/features/studio/courses/enroll-student-dialog", () => ({
  EnrollStudentDialog: () => null,
}));

vi.mock("next/link", async () => {
  const react = await import("../../../frontend/apps/web/node_modules/react");
  return {
    default: (props: { href: string; children: unknown; className?: string }) =>
      react.createElement(
        "a",
        { href: props.href, className: props.className },
        props.children as never,
      ),
  };
});

vi.mock("../../../frontend/apps/web/src/lib/client-api", () => ({
  clientApi: { get: mockGet, post: mockPost, put: mockPut },
  ClientApiError: class ClientApiError extends Error {},
}));

import {
  canChangeContentVisibility,
  contentVisibilityNotice,
  isContentHidden,
  unpublishWarning,
  updateLessonVisibility,
  updateModuleVisibility,
  visibilityActionLabel,
} from "../../../frontend/apps/web/src/features/studio/courses/content-visibility";
import { resolveLessonBadges } from "../../../frontend/apps/web/src/features/studio/courses/lesson-outline-meta";
import {
  CourseSettingsPublishCoursePanel,
  publishNote,
} from "../../../frontend/apps/web/src/features/studio/courses/course-settings-publish-course-panel";
import { CourseDetailShell } from "../../../frontend/apps/web/src/features/studio/courses/course-detail-shell";
import { resolveMutationSuccessToast } from "../../../frontend/apps/web/src/lib/feedback/toast-messages";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const courseId = "018f0000-0000-7000-8000-000000000071";
const moduleId = "018f0000-0000-7000-8000-000000000072";
const lessonId = "018f0000-0000-7000-8000-000000000073";

describe("content visibility helpers", () => {
  it("treats ARCHIVED as hidden and allows changes only in draft or live courses", () => {
    expect(isContentHidden("ARCHIVED")).toBe(true);
    expect(isContentHidden("DRAFT")).toBe(false);
    expect(isContentHidden("PUBLISHED")).toBe(false);
    expect(canChangeContentVisibility("DRAFT")).toBe(true);
    expect(canChangeContentVisibility("PUBLISHED")).toBe(true);
    expect(canChangeContentVisibility("REVIEW")).toBe(false);
    expect(canChangeContentVisibility("ARCHIVED")).toBe(false);
    expect(visibilityActionLabel(true)).toBe("Show to learners");
    expect(visibilityActionLabel(false)).toBe("Hide from learners");
    expect(contentVisibilityNotice("REVIEW")).toMatch(/after the review/);
    expect(contentVisibilityNotice("PUBLISHED")).toMatch(/straight away/);
  });

  it("badges a hidden lesson", () => {
    const badges = resolveLessonBadges({
      id: lessonId,
      slug: "lesson",
      title: "Lesson",
      position: 1,
      status: "ARCHIVED",
      lessonType: "video",
      videoUrl: null,
      durationSeconds: null,
    } as Parameters<typeof resolveLessonBadges>[0]);
    expect(badges.map((badge) => badge.label)).toEqual(["Hidden"]);
  });

  it("names how many learners lose access when a course is unpublished", () => {
    expect(unpublishWarning(0)).toMatch(/^No learners are enrolled/);
    expect(unpublishWarning(1)).toMatch(/^1 enrolled learner will lose access/);
    expect(unpublishWarning(12)).toMatch(/^12 enrolled learners will lose access/);
    expect(unpublishWarning(12)).toMatch(/enrollments and progress are kept/);
  });

  it("calls the section and lesson visibility routes with an idempotent PUT", async () => {
    mockPut.mockResolvedValue({ data: { id: moduleId, status: "ARCHIVED", visible: false } });
    await updateModuleVisibility({ moduleId, visible: false, courseStatus: "PUBLISHED" });
    expect(mockPut).toHaveBeenLastCalledWith(
      `/api/v1/modules/${moduleId}/visibility`,
      { visible: false },
      "module-visibility",
      { successMessage: "Section hidden from learners" },
    );

    mockPut.mockResolvedValue({ data: { id: lessonId, status: "DRAFT", visible: true } });
    await updateLessonVisibility({ lessonId, visible: true, courseStatus: "DRAFT" });
    expect(mockPut).toHaveBeenLastCalledWith(
      `/api/v1/lessons/${lessonId}/visibility`,
      { visible: true },
      "lesson-visibility",
      { successMessage: "Lesson will be visible once the course is approved" },
    );
  });
});

describe("unpublish course panel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockGet.mockReset();
    mockPost.mockReset();
    mockRefresh.mockReset();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function buttonByText(text: string): HTMLButtonElement {
    const button = [...document.querySelectorAll("button")].find(
      (candidate) => candidate.textContent?.trim() === text,
    );
    if (!button) throw new Error(`No button "${text}"`);
    return button;
  }

  it("warns with the enrolled learner count, then unpublishes to draft", async () => {
    mockGet.mockResolvedValue({
      data: { id: courseId, status: "PUBLISHED", canUnpublish: true, activeEnrollments: 3 },
    });
    mockPost.mockResolvedValue({
      data: {
        id: courseId,
        status: "DRAFT",
        activeEnrollments: 3,
        unpublishedAt: "2026-11-07T10:00:00.000Z",
      },
    });
    const onCourseChange = vi.fn();
    const course = { id: courseId, status: "PUBLISHED" } as never;

    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: new QueryClient() },
          createElement(CourseSettingsPublishCoursePanel, {
            course,
            courseId,
            canPublish: true,
            onCourseChange,
          }),
        ),
      );
    });

    const unpublishedRadio = container.querySelector<HTMLInputElement>(
      'input[value="unpublished"]',
    );
    await act(async () => {
      unpublishedRadio?.click();
    });
    await act(async () => {
      buttonByText("Unpublish").click();
    });

    expect(mockGet).toHaveBeenCalledWith(`/api/v1/courses/${courseId}/unpublish`);
    expect(mockPost).not.toHaveBeenCalled();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toMatch(/3 enrolled learners will lose access/);

    const confirm = [...(dialog?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent?.trim() === "Unpublish",
    );
    await act(async () => {
      confirm?.click();
    });

    expect(mockPost).toHaveBeenCalledWith(
      `/api/v1/courses/${courseId}/unpublish`,
      {},
      "course-unpublish",
      { successMessage: "Course unpublished. It is back in draft." },
    );
    expect(onCourseChange).toHaveBeenCalledWith({ id: courseId, status: "DRAFT" });
    expect(mockRefresh).toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});

// Found on staging, 7 November 2026, while checking #268.
describe("publish wording and course header state", () => {
  it("explains publishing for each course status", () => {
    expect(publishNote("DRAFT")).toMatch(/^Publishing sends the course for review/);
    expect(publishNote("REVIEW")).toMatch(/^This course is in review/);
    expect(publishNote("PUBLISHED")).toMatch(/^Unpublishing takes a live course back to draft/);
    expect(publishNote("ARCHIVED")).toMatch(/archived/);
  });

  it("calls submitting a course for review a submission, not a publish", () => {
    expect(resolveMutationSuccessToast("course-publish", "POST")).toBe(
      "Course submitted successfully",
    );
  });

  it("shows the course's new status in the header after the page refreshes", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const client = new QueryClient();
    const render = (status: "PUBLISHED" | "DRAFT") =>
      root.render(
        createElement(
          QueryClientProvider,
          { client },
          createElement(CourseDetailShell, {
            course: { id: courseId, title: "Acceptance course", status } as never,
            canPublish: true,
            children: null,
          }),
        ),
      );

    await act(async () => {
      render("PUBLISHED");
    });
    expect(container.textContent).toContain("Published");
    expect(
      [...container.querySelectorAll("button")].some((b) => b.textContent?.trim() === "Publish"),
    ).toBe(false);

    // router.refresh() after an unpublish hands the shell the course in draft.
    await act(async () => {
      render("DRAFT");
    });
    expect(
      [...container.querySelectorAll("button")].some((b) => b.textContent?.trim() === "Publish"),
    ).toBe(true);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
