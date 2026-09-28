import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createElement } from "../../../frontend/apps/web/node_modules/react";
import { renderToString } from "../../../frontend/apps/web/node_modules/react-dom/server";
import {
  LearnerDashboard,
  type LearnerDashboardData,
} from "../../../frontend/apps/web/src/features/learner/components/dashboard/LearnerDashboard";

it("keeps dashboard content on the server and scopes live currency to the trading scene", () => {
  const dashboard = readFileSync(
    "frontend/apps/web/src/features/learner/components/dashboard/LearnerDashboard.tsx",
    "utf8",
  );
  expect(dashboard).not.toMatch(/^["']use client["'];/);
  expect(dashboard).not.toContain("useCurrency");
  const scene = readFileSync(
    "frontend/apps/web/src/features/learner/components/dashboard/dashboard-ui.tsx",
    "utf8",
  );
  expect(scene).toContain("useCurrency()");
});

it("server-renders learner content and the personalized server slot", () => {
  const data: LearnerDashboardData = {
    displayName: "Ada",
    readiness: { scorePercent: 80, label: "Ready", color: "#22aa55", energy: 1 },
    level: 3,
    xpTotal: 300,
    weeklyXp: 50,
    xpIntoLevel: 10,
    xpForNextLevel: 100,
    levelProgressPercent: 10,
    streakCount: 3,
    streakFreezes: 1,
    badgeCount: 0,
    badges: [],
    trend: [{ label: "Today", value: 80 }],
    mastery: [{ key: "risk", label: "Risk", score: 80 }],
    courses: [
      { id: "enrollment-1", courseId: "course-1", title: "Risk Foundations", status: "active" },
    ],
    queue: [],
    certificates: [],
    recommended: [],
    announcement: null,
    legalCopy: { disclaimer: "Practice safely" },
  };
  const html = renderToString(
    createElement(LearnerDashboard, {
      data,
      personalizedSection: createElement("section", null, "Personalized learning path"),
    }),
  );
  expect(html).toContain("Welcome back, Ada");
  expect(html).toContain("Risk Foundations");
  expect(html).toContain("Personalized learning path");
  expect(html).toContain("Practice safely");
});
