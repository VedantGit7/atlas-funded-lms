import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../../frontend/apps/web/src");

describe("F4 learner wire gaps + lesson player", () => {
  it("wires community reactions, reports, and appeals", () => {
    expect(existsSync(resolve(webRoot, "features/community/community-api.ts"))).toBe(true);
    expect(existsSync(resolve(webRoot, "features/community/components/ReactionToggle.tsx"))).toBe(
      true,
    );
    expect(existsSync(resolve(webRoot, "features/community/components/ReportContentDialog.tsx"))).toBe(
      true,
    );
    expect(existsSync(resolve(webRoot, "features/community/components/SubmitAppealDialog.tsx"))).toBe(
      true,
    );

    const moderationApi = readFileSync(resolve(webRoot, "features/moderation/api.ts"), "utf8");
    expect(moderationApi).toContain("export async function createAppeal");

    const spaceFeed = readFileSync(resolve(webRoot, "features/community/components/SpaceFeed.tsx"), "utf8");
    expect(spaceFeed).toContain("PostCard");

    const postCard = readFileSync(
      resolve(webRoot, "features/community/components/PostCard.tsx"),
      "utf8",
    );
    expect(postCard).toContain("ReactionToggle");
    expect(postCard).toContain("ReportContentDialog");
    expect(postCard).toContain("SubmitAppealDialog");
    expect(postCard).toContain("appealableModerationCaseId");

    const commentTree = readFileSync(
      resolve(webRoot, "features/community/components/CommentTree.tsx"),
      "utf8",
    );
    expect(commentTree).toContain("ReactionToggle");
    expect(commentTree).toContain("ReportContentDialog");
    expect(commentTree).toContain("SubmitAppealDialog");
  });

  it("includes mobile lesson player shell and progress context", () => {
    expect(existsSync(resolve(webRoot, "features/lessons/lesson-progress-context.tsx"))).toBe(true);
    expect(existsSync(resolve(webRoot, "features/lessons/lesson-autosave-indicator.tsx"))).toBe(
      true,
    );
    expect(
      existsSync(resolve(webRoot, "app/courses/[id]/lessons/[lessonId]/loading.tsx")),
    ).toBe(true);

    const shell = readFileSync(resolve(webRoot, "features/lessons/lesson-player-shell.tsx"), "utf8");
    expect(shell).toContain("LessonProgressProvider");
    expect(shell).toContain("fixed inset-x-0 bottom-0");
    expect(shell).toContain("LessonAutosaveIndicator");
  });

  it("enriches continue-learning on the learner dashboard", () => {
    expect(existsSync(resolve(webRoot, "features/learner/components/ContinueLearningCard.tsx"))).toBe(
      true,
    );

    const dashboardView = readFileSync(
      resolve(webRoot, "features/learner/components/LearnerDashboardView.tsx"),
      "utf8",
    );
    expect(dashboardView).toContain("personalizedSection");

    const homePage = readFileSync(resolve(webRoot, "app/page.tsx"), "utf8");
    expect(homePage).toContain("DashboardPersonalizedIsland");
    expect(homePage).toContain("Suspense");

    const personalizedLoader = readFileSync(
      resolve(webRoot, "features/learner/server/load-personalized-dashboard.ts"),
      "utf8",
    );
    expect(personalizedLoader).toContain("/api/v1/enrollments");
    expect(personalizedLoader).toContain("resumeLessonId");
  });
});

describe("F4 follow-up fixes", () => {
  it("exposes viewer reactions, appealable cases, and resume lesson wiring", () => {
    const postDto = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../frontend/packages/contracts/src/community/community.dto.ts",
      ),
      "utf8",
    );
    expect(postDto).toContain("viewerReactionKeys");
    expect(postDto).toContain("appealableModerationCaseId");

    const courseSchema = readFileSync(
      resolve(import.meta.dirname, "../../../frontend/packages/contracts/src/courses/schemas.ts"),
      "utf8",
    );
    expect(courseSchema).toContain("resumeLessonId");

    const reactionToggle = readFileSync(
      resolve(webRoot, "features/community/components/ReactionToggle.tsx"),
      "utf8",
    );
    expect(reactionToggle).toContain("initialViewerReactionKeys");

    const moderationService = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../backend/apps/api/src/server/moderation/moderation.service.ts",
      ),
      "utf8",
    );
    expect(moderationService).toContain("notifyAuthorOfModerationAction");
    expect(moderationService).toContain("appealCase=");
  });
});

describe("F4 audit polish", () => {
  it("loads posts by id, redirects finished attempts, and surfaces deletion pending state", () => {
    const communityApi = readFileSync(
      resolve(webRoot, "modules/community/community.server-api.ts"),
      "utf8",
    );
    expect(communityApi).toContain("getPost");

    const postPage = readFileSync(
      resolve(webRoot, "app/(learner)/community/posts/[id]/page.tsx"),
      "utf8",
    );
    expect(postPage).toContain("communityServerApi.getPost");
    expect(postPage).not.toContain("resolvePostBody");

    const attemptPage = readFileSync(resolve(webRoot, "app/attempts/[id]/page.tsx"), "utf8");
    expect(attemptPage).toContain("redirect(`/attempts/${id}/result`)");

    // The monolithic /settings page was split into the /profile settings shell;
    // account deletion now lives on the Danger Zone tab.
    const dangerZonePage = readFileSync(
      resolve(webRoot, "app/profile/danger-zone/page.tsx"),
      "utf8",
    );
    expect(dangerZonePage).toContain("/api/v1/me/deletion-request");
    expect(dangerZonePage).toContain("initialPending={deletionStatus.data.pending}");

    expect(
      existsSync(resolve(webRoot, "app/(learner)/community/spaces/[id]/loading.tsx")),
    ).toBe(true);
    expect(
      existsSync(resolve(webRoot, "app/(learner)/community/posts/[id]/loading.tsx")),
    ).toBe(true);
  });

  it("optimizes lesson position saves and wires profile avatar plus leaderboard deep links", () => {
    const progressContext = readFileSync(
      resolve(webRoot, "features/lessons/lesson-progress-context.tsx"),
      "utf8",
    );
    expect(progressContext).toContain("setProgress(optimistic)");
    expect(progressContext).toContain("setProgress(previous)");

    const profilePage = readFileSync(resolve(webRoot, "app/profile/page.tsx"), "utf8");
    expect(profilePage).toContain("initialAvatarUrl");

    const profileForm = readFileSync(
      resolve(webRoot, "features/learner/components/ProfileForm.tsx"),
      "utf8",
    );
    expect(profileForm).toContain("initialAvatarUrl");

    const leaderboardsPage = readFileSync(
      resolve(webRoot, "app/(learner)/leaderboards/page.tsx"),
      "utf8",
    );
    expect(leaderboardsPage).toContain('readSearchParam(query, "board")');

    const hallOfFamePage = readFileSync(
      resolve(webRoot, "app/(learner)/hall-of-fame/page.tsx"),
      "utf8",
    );
    expect(hallOfFamePage).toContain("ServerApiError");
    expect(hallOfFamePage).not.toMatch(/catch \{\s*return/);
  });

  it("exposes learner deletion pending status and post-by-id API", () => {
    expect(
      existsSync(
        resolve(
          import.meta.dirname,
          "../../../backend/apps/api/src/app/api/v1/me/deletion-request/route.ts",
        ),
      ),
    ).toBe(true);

    const postsRoute = readFileSync(
      resolve(import.meta.dirname, "../../../backend/apps/api/src/app/api/v1/posts/[id]/route.ts"),
      "utf8",
    );
    expect(postsRoute).toContain("getPostById");

    const dataRightsService = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../backend/packages/domain/src/data-rights/data-rights.service.ts",
      ),
      "utf8",
    );
    expect(dataRightsService).toContain("getMyDeletionRequestStatus");
  });
});

describe("F4 backend learner report permission", () => {
  it("grants community.report to learners and uses it for case creation", () => {
    const matrix = readFileSync(
      resolve(import.meta.dirname, "../../../backend/packages/access/src/seed/role-permission-matrix.ts"),
      "utf8",
    );
    expect(matrix).toContain('"community.report"');

    const metadata = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../backend/apps/api/src/server/moderation/moderation.route-metadata.ts",
      ),
      "utf8",
    );
    expect(metadata).toContain('permission: "community.report"');
  });
});
