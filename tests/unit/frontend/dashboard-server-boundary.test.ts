import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createElement } from "../../../frontend/apps/web/node_modules/react";
import { renderToString } from "../../../frontend/apps/web/node_modules/react-dom/server";
import {
  LearnerDashboard,
  type LearnerDashboardData,
} from "../../../frontend/apps/web/src/features/learner/components/dashboard/LearnerDashboard";

it("keeps the learner home on the server, with no trading scene or live prices", () => {
  const dashboard = readFileSync(
    "frontend/apps/web/src/features/learner/components/dashboard/LearnerDashboard.tsx",
    "utf8",
  );
  expect(dashboard).not.toMatch(/^["']use client["'];/);
  expect(dashboard).not.toContain("useCurrency");
  const ui = readFileSync(
    "frontend/apps/web/src/features/learner/components/dashboard/dashboard-ui.tsx",
    "utf8",
  );
  // QA review 1 M36: the random BTC/USDT chart is gone.
  expect(ui).not.toContain("TradingScene");
});

it("server-renders the course to continue, by its title, with its next lesson", () => {
  const data: LearnerDashboardData = {
    displayName: "Ada",
    courses: [
      {
        courseId: "018f0000-0000-7000-8000-0000000000c1",
        title: "Risk Foundations",
        coverKey: null,
        category: null,
        enrolledAt: "2026-11-20T10:00:00.000Z",
        completedAt: null,
        lastActivityAt: "2026-11-26T10:00:00.000Z",
        totalLessons: 4,
        completedLessons: 1,
        progressPct: 25,
        status: "in_progress",
        nextLesson: { id: "018f0000-0000-7000-8000-0000000000a2", title: "Position sizing" },
        lessons: [
          { id: "018f0000-0000-7000-8000-0000000000a1", status: "completed" },
          { id: "018f0000-0000-7000-8000-0000000000a2", status: "in_progress" },
          { id: "018f0000-0000-7000-8000-0000000000a3", status: "not_started" },
          { id: "018f0000-0000-7000-8000-0000000000a4", status: "not_started" },
        ],
      },
    ],
    announcement: null,
    gamification: null,
    readiness: null,
    mastery: [],
    certificates: [],
    paths: [],
    readinessNote: null,
  };
  const html = renderToString(createElement(LearnerDashboard, { data }));
  expect(html).toContain("Welcome back, Ada");
  expect(html).toContain("Risk Foundations");
  expect(html).toContain("Position sizing");
  expect(html).toContain("1 of 4 lessons done");
  expect(html).toContain(
    'href="/courses/018f0000-0000-7000-8000-0000000000c1/lessons/018f0000-0000-7000-8000-0000000000a2"',
  );
  // Gamification off: no streak, level or XP.
  expect(html).not.toContain("XP");
  expect(html).not.toContain("streak");
});
