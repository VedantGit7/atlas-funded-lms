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
  canEditCourseContent,
  contentVisibilityAction,
  contentVisibilityNotice,
  isContentHidden,
  unpublishWarning,
  updateLessonVisibility,
  updateModuleVisibility,
  visibilityResultMessage,
} from "../../../frontend/apps/web/src/features/studio/courses/content-visibility";
import { resolveLessonBadges } from "../../../frontend/apps/web/src/features/studio/courses/lesson-outline-meta";
import { lessonEditorStatus } from "../../../frontend/apps/web/src/features/studio/courses/inline-lesson-editor/lesson-status-strip";
import { trashActionMessage } from "../../../frontend/apps/web/src/features/admin/trash/AdminTrashPanel";
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
    expect(contentVisibilityNotice("REVIEW")).toMatch(/after the review/);
    expect(contentVisibilityNotice("PUBLISHED")).toMatch(/stay as drafts until you publish them/);
  });

  // QA review 1 C27, review 2 C2, C3: a live course's content can be edited.
  it("allows editing content in draft and live courses only", () => {
    expect(canEditCourseContent("DRAFT")).toBe(true);
    expect(canEditCourseContent("PUBLISHED")).toBe(true);
    expect(canEditCourseContent("REVIEW")).toBe(false);
    expect(canEditCourseContent("ARCHIVED")).toBe(false);
  });

  // QA review 2 H10: one control per section or lesson.
  it("offers one action: publish a draft in a live course, otherwise show or hide", () => {
    const action = (
      status: "DRAFT" | "PUBLISHED" | "ARCHIVED",
      courseStatus: "DRAFT" | "PUBLISHED",
    ) => contentVisibilityAction({ kind: "Lesson", status, courseStatus });
    expect(action("DRAFT", "PUBLISHED")).toEqual({ label: "Publish lesson", visible: true });
    expect(
      contentVisibilityAction({ kind: "Section", status: "DRAFT", courseStatus: "PUBLISHED" }),
    ).toEqual({ label: "Publish section", visible: true });
    expect(action("PUBLISHED", "PUBLISHED")).toEqual({
      label: "Hide",
      visible: false,
    });
    expect(action("ARCHIVED", "PUBLISHED")).toEqual({ label: "Show to learners", visible: true });
    expect(action("DRAFT", "DRAFT")).toEqual({ label: "Hide", visible: false });
    expect(action("ARCHIVED", "DRAFT")).toEqual({ label: "Show to learners", visible: true });
  });

  it("badges drafts only in a live course, and hidden content everywhere", () => {
    const lesson = (status: "DRAFT" | "PUBLISHED" | "ARCHIVED") =>
      ({
        id: lessonId,
        slug: "lesson",
        title: "Lesson",
        position: 1,
        status,
        lessonType: "video",
        videoUrl: null,
        durationSeconds: null,
      }) as Parameters<typeof resolveLessonBadges>[0];
    const labels = (
      status: "DRAFT" | "PUBLISHED" | "ARCHIVED",
      courseStatus: "DRAFT" | "PUBLISHED",
    ) => resolveLessonBadges(lesson(status), courseStatus).map((badge) => badge.label);
    expect(labels("ARCHIVED", "DRAFT")).toEqual(["Hidden"]);
    expect(labels("ARCHIVED", "PUBLISHED")).toEqual(["Hidden"]);
    expect(labels("DRAFT", "PUBLISHED")).toEqual(["Draft"]);
    // Everything in a draft course is unpublished: no badge (it read like a hide switch).
    expect(labels("DRAFT", "DRAFT")).toEqual([]);
    expect(labels("PUBLISHED", "PUBLISHED")).toEqual([]);
  });

  it("says what a visibility change did", () => {
    const result = (status: "DRAFT" | "PUBLISHED" | "ARCHIVED", lessonsPublished?: number) => ({
      id: moduleId,
      status,
      visible: status !== "ARCHIVED",
      ...(lessonsPublished !== undefined ? { lessonsPublished } : {}),
    });
    expect(
      visibilityResultMessage({
        kind: "Section",
        before: "DRAFT",
        result: result("PUBLISHED", 3),
        courseStatus: "PUBLISHED",
      }),
    ).toBe("Section published, with 3 lessons. Learners can see it now.");
    expect(
      visibilityResultMessage({
        kind: "Lesson",
        before: "ARCHIVED",
        result: result("PUBLISHED"),
        courseStatus: "PUBLISHED",
      }),
    ).toBe("Lesson is visible to learners");
    expect(
      visibilityResultMessage({
        kind: "Lesson",
        before: "PUBLISHED",
        result: result("ARCHIVED"),
        courseStatus: "PUBLISHED",
      }),
    ).toBe("Lesson hidden from learners");
    expect(
      visibilityResultMessage({
        kind: "Lesson",
        before: "ARCHIVED",
        result: result("DRAFT"),
        courseStatus: "DRAFT",
      }),
    ).toBe("Lesson will be visible once the course is approved");
  });

  it("tells the author in the lesson editor who sees the lesson", () => {
    expect(
      lessonEditorStatus({
        status: "PUBLISHED",
        moduleStatus: "PUBLISHED",
        courseStatus: "PUBLISHED",
      }),
    ).toMatchObject({ tone: "live", action: { label: "Hide" } });
    expect(
      lessonEditorStatus({ status: "DRAFT", moduleStatus: "PUBLISHED", courseStatus: "PUBLISHED" }),
    ).toMatchObject({ tone: "draft", action: { label: "Publish lesson", visible: true } });
    expect(
      lessonEditorStatus({ status: "PUBLISHED", moduleStatus: "DRAFT", courseStatus: "PUBLISHED" })
        ?.text,
    ).toMatch(/its section isn't/);
    expect(
      lessonEditorStatus({ status: "DRAFT", moduleStatus: "DRAFT", courseStatus: "REVIEW" }),
    ).toMatchObject({ tone: "locked", action: null });
    // A draft course says nothing: everything waits for review.
    expect(
      lessonEditorStatus({ status: "DRAFT", moduleStatus: "DRAFT", courseStatus: "DRAFT" }),
    ).toBeNull();
  });

  // QA review 2 H28: the restore toast was built from an internal ID.
  it("names what Trash restored or deleted", () => {
    expect(trashActionMessage("restore", "lessons")).toBe("Lesson restored");
    expect(trashActionMessage("restore", "sections")).toBe("Section restored");
    expect(trashActionMessage("purge", "courses")).toBe("Course deleted for good");
  });

  it("names how many learners lose access when a course is unpublished", () => {
    expect(unpublishWarning(0)).toMatch(/^No learners are enrolled/);
    expect(unpublishWarning(1)).toMatch(/^1 enrolled learner will lose access/);
    expect(unpublishWarning(12)).toMatch(/^12 enrolled learners will lose access/);
    expect(unpublishWarning(12)).toMatch(/enrollments and progress are kept/);
  });

  it("calls the section and lesson visibility routes with an idempotent PUT", async () => {
    mockPut.mockResolvedValue({ data: { id: moduleId, status: "ARCHIVED", visible: false } });
    await updateModuleVisibility({ moduleId, visible: false });
    // Silent: the caller says what happened, from the result.
    expect(mockPut).toHaveBeenLastCalledWith(
      `/api/v1/modules/${moduleId}/visibility`,
      { visible: false },
      "module-visibility",
      { silent: true },
    );

    mockPut.mockResolvedValue({ data: { id: lessonId, status: "DRAFT", visible: true } });
    await updateLessonVisibility({ lessonId, visible: true });
    expect(mockPut).toHaveBeenLastCalledWith(
      `/api/v1/lessons/${lessonId}/visibility`,
      { visible: true },
      "lesson-visibility",
      { silent: true },
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
    expect(dialog?.textContent).toMatch(/use the course editor instead/);

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
    expect(publishNote("PUBLISHED")).toMatch(/being updated/);
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
