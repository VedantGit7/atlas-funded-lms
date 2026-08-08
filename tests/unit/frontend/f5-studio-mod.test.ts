import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../../frontend/apps/web/src");

describe("F5 wire gaps", () => {
  it("wires PUT spaces, PUT item-collections, PUT leaderboards, and POST workflows", () => {
    const spacesEditor = readFileSync(
      resolve(webRoot, "features/community/components/AdminSpacesEditor.tsx"),
      "utf8",
    );
    expect(spacesEditor).toContain('clientApi.put');
    expect(spacesEditor).toContain('"/api/v1/spaces"');

    const itemApi = readFileSync(resolve(webRoot, "features/item-registry/api.ts"), "utf8");
    expect(itemApi).toContain("updateItemCollection");
    expect(itemApi).toContain("`/api/v1/item-collections/${collectionId}`");

    const gamificationEditor = readFileSync(
      resolve(webRoot, "features/gamification/components/AdminGamificationEditor.tsx"),
      "utf8",
    );
    expect(gamificationEditor).toContain("updateLeaderboard");
    expect(gamificationEditor).toContain('"/api/v1/leaderboards"');

    const workflowsAdmin = readFileSync(
      resolve(webRoot, "features/admin/workflows/WorkflowsAdmin.tsx"),
      "utf8",
    );
    expect(workflowsAdmin).toContain('"/api/v1/workflows"');
    expect(workflowsAdmin).toContain("createDefinition");
  });

  it("improves I7 collection management without full page reload", () => {
    const collectionsTable = readFileSync(
      resolve(webRoot, "features/item-registry/components/item-collections-table.tsx"),
      "utf8",
    );
    expect(collectionsTable).toContain("updateItemCollection");
    expect(collectionsTable).toContain("deleteItemCollection");
    expect(collectionsTable).toContain("listCollectionItems");
    expect(collectionsTable).toContain("removeItemFromCollection");
    expect(collectionsTable).toContain("useMutation");
    expect(collectionsTable).not.toContain("window.location.reload");
  });

  it("closes F5 backlog: multi-target review, roster depth, access settings, lazy builders", () => {
    const reviewClient = readFileSync(
      resolve(webRoot, "features/workflows/review-approvals-client.tsx"),
      "utf8",
    );
    expect(reviewClient).toContain("learning_path");
    expect(reviewClient).toContain("assessment");

    const roster = readFileSync(
      resolve(webRoot, "features/studio/learners/course-learner-roster.tsx"),
      "utf8",
    );
    expect(roster).toContain("cancelEnrollment");
    expect(roster).toContain("issueCourseCertificate");
    expect(roster).toContain("fetchLearnerAttemptSummaries");
    expect(roster).toContain("/attempts/");

    const settings = readFileSync(
      resolve(webRoot, "features/studio/courses/course-settings-form.tsx"),
      "utf8",
    );
    expect(settings).toContain("mergeCourseAccessIntoTags");

    expect(existsSync(resolve(webRoot, "features/studio/courses/course-builder-lazy.tsx"))).toBe(
      true,
    );
  });
});

describe("F5 route coverage", () => {
  it("maps studio, moderation, and review registry screens to pages", () => {
    const studioRegistry = readFileSync(
      resolve(webRoot, "features/studio/studio-route-registry.ts"),
      "utf8",
    );
    expect(studioRegistry).toContain('"I1"');
    expect(studioRegistry).toContain('"I13"');

    const moderationRegistry = readFileSync(
      resolve(webRoot, "features/moderation/moderation-route-registry.ts"),
      "utf8",
    );
    expect(moderationRegistry).toContain('"M1"');
    expect(moderationRegistry).toContain('"M4"');

    expect(existsSync(resolve(webRoot, "app/review/page.tsx"))).toBe(true);
    expect(existsSync(resolve(webRoot, "app/studio/page.tsx"))).toBe(true);
    expect(existsSync(resolve(webRoot, "app/admin/moderation/cases/page.tsx"))).toBe(true);
  });
});

describe("F5 remaining gaps", () => {
  it("loads workflow history from API and supports dimension weight editing", () => {
    const reviewClient = readFileSync(
      resolve(webRoot, "features/workflows/review-approvals-client.tsx"),
      "utf8",
    );
    expect(reviewClient).toContain("getWorkflowHistory");

    const workflowsApi = readFileSync(resolve(webRoot, "features/workflows/api.ts"), "utf8");
    expect(workflowsApi).toContain("/api/v1/workflows/history");

    const itemEditor = readFileSync(
      resolve(webRoot, "features/item-registry/components/item-editor-form.tsx"),
      "utf8",
    );
    expect(itemEditor).toContain("putDimensionWeights");

    const reviewPage = readFileSync(resolve(webRoot, "app/review/page.tsx"), "utf8");
    expect(reviewPage).not.toContain("targetType=course");
  });

  it("uses mutations in core studio and moderation surfaces", () => {
    const courseBuilder = readFileSync(
      resolve(webRoot, "features/studio/courses/course-builder.tsx"),
      "utf8",
    );
    expect(courseBuilder).toContain("useMutation");

    const settings = readFileSync(
      resolve(webRoot, "features/studio/courses/course-settings-form.tsx"),
      "utf8",
    );
    expect(settings).toContain("useMutation");

    const spacesEditor = readFileSync(
      resolve(webRoot, "features/community/components/AdminSpacesEditor.tsx"),
      "utf8",
    );
    expect(spacesEditor).toContain("useMutation");

    const moderation = readFileSync(
      resolve(webRoot, "features/moderation/components/ModerationQueueClient.tsx"),
      "utf8",
    );
    expect(moderation).toContain("useMutation");
  });

  it("hydrates grading SSR data and removes dead learner roster prefetch", () => {
    const gradingPage = readFileSync(resolve(webRoot, "app/studio/grading/page.tsx"), "utf8");
    expect(gradingPage).toContain("initialTasks={initialQueue.data}");

    const learnersPage = readFileSync(
      resolve(webRoot, "app/studio/courses/[id]/learners/page.tsx"),
      "utf8",
    );
    expect(learnersPage).not.toContain("/api/v1/enrollments");
  });
});
