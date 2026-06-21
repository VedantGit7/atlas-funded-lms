import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../apps/web/src");

const communityPaths = [
  "app/(learner)/community/page.tsx",
  "app/(learner)/community/layout.tsx",
  "app/(learner)/community/spaces/[id]/page.tsx",
  "app/(learner)/community/posts/[id]/page.tsx",
  "app/(learner)/hall-of-fame/page.tsx",
  "app/(learner)/hall-of-fame/layout.tsx",
  "app/(moderation)/moderate/spaces/page.tsx",
  "app/api/v1/spaces/route.ts",
  "app/api/v1/spaces/route.metadata.ts",
  "app/api/v1/spaces/[id]/join/route.ts",
  "app/api/v1/spaces/[id]/posts/route.ts",
  "app/api/v1/posts/[id]/comments/route.ts",
  "app/api/v1/comments/[id]/route.ts",
  "app/api/v1/reactions/route.ts",
  "server/community/community.service.ts",
  "server/community/community.hall-of-fame-service.ts",
  "features/community/components/CommunityHub.tsx",
  "features/community/components/HallOfFameView.tsx",
  "features/community/components/AdminSpacesEditor.tsx",
  "modules/community/community.server-api.ts",
];

describe("community e2e wiring", () => {
  it("includes approved screens, APIs, and services", () => {
    for (const relativePath of communityPaths) {
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
    }
  });

  it("community hub uses approved server API", () => {
    const source = readFileSync(resolve(webRoot, "app/(learner)/community/page.tsx"), "utf8");
    expect(source).toContain("communityServerApi");
    expect(source).toContain("CommunityHub");
  });

  it("hall of fame resolves config server-side without client ids", () => {
    const source = readFileSync(resolve(webRoot, "app/(learner)/hall-of-fame/page.tsx"), "utf8");
    expect(source).toContain("loadHallOfFamePageData");
    expect(source).not.toContain("searchParams");
    expect(source).not.toContain("leaderboardId");
  });

  it("hall of fame view avoids funded language and dangerouslySetInnerHTML", () => {
    const source = readFileSync(
      resolve(webRoot, "features/community/components/HallOfFameView.tsx"),
      "utf8",
    );
    expect(source).not.toContain("dangerouslySetInnerHTML");
    expect(source.toLowerCase()).not.toContain("funded");
    expect(source).toContain("Verify credential");
  });

  it("learner shell links to community and hall of fame", () => {
    const source = readFileSync(resolve(webRoot, "components/shells/LearnerShell.tsx"), "utf8");
    expect(source).toContain("/community");
    expect(source).toContain("/hall-of-fame");
  });

  it("community service emits community.post.created only", () => {
    const source = readFileSync(resolve(webRoot, "server/community/community.service.ts"), "utf8");
    expect(source).toContain("community.post.created");
    expect(source).not.toContain("notification_dispatches");
    expect(source).not.toContain("search_index_entries");
    expect(source).not.toContain("analytics_rollups");
  });
});
