import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../frontend/apps/web/src");

const lessonPaths = [
  "app/studio/courses/[id]/lessons/[lessonId]/page.tsx",
  "app/courses/[id]/lessons/[lessonId]/page.tsx",
  "features/studio/courses/inline-lesson-editor/inline-lesson-editor.tsx",
  "features/studio/courses/inline-lesson-editor/lesson-article-workspace.tsx",
  "features/studio/lessons/delete-lesson-dialog.tsx",
  "features/lessons/lesson-player-shell.tsx",
  "features/lessons/lesson-content-viewer.tsx",
  "features/lessons/lesson-body.tsx",
  "features/lessons/article-markdown.tsx",
  "features/lessons/lesson-asset-list.tsx",
  "features/lessons/lesson-progress-panel.tsx",
  "features/lessons/lesson-next-action.tsx",
  "features/lessons/mark-complete-button.tsx",
  "app/api/v1/modules/[id]/lessons/route.ts",
  "app/api/v1/lessons/[id]/route.ts",
  "app/api/v1/lessons/[id]/assets/route.ts",
  "app/api/v1/lessons/[id]/progress/route.ts",
];

describe("lesson editor player progress e2e wiring", () => {
  it("includes approved lesson screen and API files", () => {
    for (const relativePath of lessonPaths) {
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
    }
  });

  it("uses PageGate on lesson player page", () => {
    const source = readFileSync(
      resolve(webRoot, "app/courses/[id]/lessons/[lessonId]/page.tsx"),
      "utf8",
    );
    expect(source).toContain("PageGate");
    expect(source).toContain("Lesson not found or access denied");
  });

  it("does not send tenant_id from lesson player components", () => {
    const source = readFileSync(
      resolve(webRoot, "features/lessons/mark-complete-button.tsx"),
      "utf8",
    );
    expect(source).toContain("/progress");
    expect(source).not.toMatch(/tenant_id|tenantId|membershipId|userId/);
  });

  it("opens lessons in the course builder, the one lesson editor", () => {
    const source = readFileSync(
      resolve(webRoot, "app/studio/courses/[id]/lessons/[lessonId]/page.tsx"),
      "utf8",
    );
    expect(source).toContain("redirect(");
    expect(source).toContain("/editor?");
    expect(existsSync(resolve(webRoot, "features/studio/lessons/lesson-editor.tsx"))).toBe(false);
  });

  it("shows the Studio preview with the learner lesson body", () => {
    const source = readFileSync(
      resolve(webRoot, "features/studio/courses/inline-lesson-editor/inline-lesson-editor.tsx"),
      "utf8",
    );
    expect(source).toContain("LessonBody");
    expect(source).toContain("playerContent");
  });

  it("lesson player supports next/previous navigation", () => {
    const source = readFileSync(
      resolve(webRoot, "features/lessons/lesson-next-action.tsx"),
      "utf8",
    );
    expect(source).toContain("Previous lesson");
    expect(source).toContain("Next lesson");
  });

  it("marks completion via progress API", () => {
    const source = readFileSync(
      resolve(webRoot, "features/lessons/mark-complete-button.tsx"),
      "utf8",
    );
    expect(source).toContain("completed: true");
    expect(source).toContain("Lesson completed");
  });
});
