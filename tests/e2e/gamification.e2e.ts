import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../apps/web/src");

const gamificationPaths = [
  "app/(learner)/achievements/page.tsx",
  "app/(learner)/achievements/layout.tsx",
  "app/(learner)/leaderboards/page.tsx",
  "app/(learner)/leaderboards/layout.tsx",
  "app/admin/gamification/page.tsx",
  "app/api/v1/me/gamification/route.ts",
  "app/api/v1/me/gamification/route.metadata.ts",
  "app/api/v1/me/streaks/route.ts",
  "app/api/v1/me/streaks/route.metadata.ts",
  "app/api/v1/me/streaks/[key]/freeze/route.ts",
  "app/api/v1/me/streaks/[key]/freeze/route.metadata.ts",
  "app/api/v1/badges/route.ts",
  "app/api/v1/badges/route.metadata.ts",
  "app/api/v1/leaderboards/route.ts",
  "app/api/v1/leaderboards/route.metadata.ts",
  "app/api/v1/leaderboards/[id]/route.ts",
  "app/api/v1/leaderboards/[id]/route.metadata.ts",
  "server/gamification/gamification.service.ts",
  "server/gamification/gamification.worker.ts",
  "features/gamification/components/GamificationSummaryCard.tsx",
  "features/gamification/components/StreakPanel.tsx",
  "features/gamification/components/LeaderboardTable.tsx",
  "features/gamification/components/AdminGamificationEditor.tsx",
];

describe("gamification e2e wiring", () => {
  it("includes approved screens, APIs, and worker wiring", () => {
    for (const relativePath of gamificationPaths) {
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
    }
  });

  it("achievements page uses approved APIs", () => {
    const source = readFileSync(resolve(webRoot, "app/(learner)/achievements/page.tsx"), "utf8");
    expect(source).toContain("gamificationServerApi");
    expect(source).toContain("StreakPanel");
  });

  it("worker consumes practice.session_completed without point award routes", () => {
    const workerSource = readFileSync(
      resolve(webRoot, "server/gamification/gamification.worker.ts"),
      "utf8",
    );
    expect(workerSource).toContain("practice.session_completed");
    expect(workerSource).not.toMatch(/awardPoints|POST.*\/points/);
  });

  it("learner shell links to achievements and leaderboards", () => {
    const source = readFileSync(resolve(webRoot, "components/shells/LearnerShell.tsx"), "utf8");
    expect(source).toContain("/achievements");
    expect(source).toContain("/leaderboards");
  });

  it("leaderboard table masks other learners", () => {
    const source = readFileSync(
      resolve(webRoot, "features/gamification/components/LeaderboardTable.tsx"),
      "utf8",
    );
    expect(source).toContain("entry.label");
    expect(source).not.toContain("displayName");
    expect(source).not.toContain("email");
  });
});
