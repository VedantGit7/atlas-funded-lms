import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MyCourse } from "../../../frontend/packages/contracts/src/enrollments/my-courses.schemas";

/** QA remediation S3.3: learner home and Progress (review 1 M31, M32, M35, M36, m38). */

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../../frontend/apps/web/src/lib/server-api", () => ({ serverApi: api }));

import {
  courseActionHref,
  courseActionLabel,
  courseStatusLabel,
  homeAnnouncement,
  homeGreeting,
  homeSubtitle,
  levelProgressLabel,
  pickContinueCourse,
} from "../../../frontend/apps/web/src/features/learner/components/dashboard/dashboard-model";
import { loadLearnerDashboardData } from "../../../frontend/apps/web/src/features/learner/components/dashboard/dashboard-data.server";

function course(overrides: Partial<MyCourse> = {}): MyCourse {
  return {
    courseId: "018f0000-0000-7000-8000-0000000000c1",
    title: "Candlestick basics",
    coverKey: null,
    category: null,
    enrolledAt: "2026-11-20T10:00:00.000Z",
    completedAt: null,
    lastActivityAt: null,
    totalLessons: 3,
    completedLessons: 0,
    progressPct: 0,
    status: "not_started",
    nextLesson: { id: "018f0000-0000-7000-8000-0000000000a1", title: "What a candle shows" },
    lessons: [],
    ...overrides,
  };
}

describe("greeting (m38)", () => {
  it("says Welcome on a first visit and Welcome back once the learner has a course", () => {
    expect(homeGreeting("Asha", [])).toBe("Welcome, Asha");
    expect(homeGreeting(null, null)).toBe("Welcome");
    expect(homeGreeting("  ", [course()])).toBe("Welcome back");
    expect(homeGreeting("Asha", [course()])).toBe("Welcome back, Asha");
  });

  it("says what to do next", () => {
    expect(homeSubtitle([])).toBe("Choose a course from the catalogue to get started.");
    expect(homeSubtitle([course({ status: "in_progress" })])).toBe("Pick up where you left off.");
    expect(homeSubtitle([course({ status: "completed" })])).toBe(
      "You've finished every course you're enrolled in.",
    );
    expect(homeSubtitle([course()])).toBe("Your courses are ready when you are.");
  });
});

describe("continue learning (M32)", () => {
  it("leads with the started course, else one not started, never a finished one", () => {
    const started = course({ courseId: "s", status: "in_progress" });
    const fresh = course({ courseId: "f" });
    const done = course({ courseId: "d", status: "completed", nextLesson: null });
    const empty = course({ courseId: "e", totalLessons: 0, nextLesson: null });
    expect(pickContinueCourse([started, fresh, done])?.courseId).toBe("s");
    expect(pickContinueCourse([empty, fresh, done])?.courseId).toBe("f");
    expect(pickContinueCourse([done])).toBeNull();
    expect(pickContinueCourse(null)).toBeNull();
  });

  it("opens the next lesson, or the course page once finished", () => {
    expect(courseActionLabel(course())).toBe("Start the course");
    expect(courseActionLabel(course({ status: "in_progress" }))).toBe("Continue");
    expect(courseActionLabel(course({ status: "completed" }))).toBe("Review");
    expect(courseActionHref(course())).toBe(
      "/courses/018f0000-0000-7000-8000-0000000000c1/lessons/018f0000-0000-7000-8000-0000000000a1",
    );
    expect(courseActionHref(course({ nextLesson: null }))).toBe(
      "/courses/018f0000-0000-7000-8000-0000000000c1",
    );
    expect(courseStatusLabel("completed")).toBe("Finished");
  });
});

describe("announcement headline (M35)", () => {
  const now = new Date("2026-11-27T12:00:00.000Z");
  const item = {
    id: "n1",
    title: " New course out ",
    body: "Risk management basics",
    actionPath: "/courses",
    createdAt: "2026-11-25T12:00:00.000Z",
  };

  it("shows a recent announcement with its link", () => {
    expect(homeAnnouncement(item, now)).toEqual({
      id: "n1",
      title: "New course out",
      body: "Risk management basics",
      href: "/courses",
      at: "2026-11-25T12:00:00.000Z",
    });
  });

  it("drops old announcements and links that go nowhere or off-site", () => {
    expect(homeAnnouncement({ ...item, createdAt: "2026-10-01T12:00:00.000Z" }, now)).toBeNull();
    expect(homeAnnouncement({ ...item, actionPath: "/" }, now)?.href).toBeNull();
    expect(homeAnnouncement({ ...item, actionPath: "//evil.example" }, now)?.href).toBeNull();
    expect(homeAnnouncement({ ...item, title: " " }, now)).toBeNull();
    expect(homeAnnouncement(null, now)).toBeNull();
  });
});

describe("level (m38)", () => {
  it("names the XP to the next level, or the top level", () => {
    expect(
      levelProgressLabel({ levelNumber: 1, xpIntoLevel: 40, xpForNextLevel: 100, progressPct: 40 }),
    ).toBe("40 of 100 XP to level 2");
    expect(
      levelProgressLabel({
        levelNumber: 9,
        xpIntoLevel: 10,
        xpForNextLevel: null,
        progressPct: 100,
      }),
    ).toBe("Top level");
  });
});

describe("home data (M31, M35)", () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it("asks for announcements only and leaves out switched-off features", async () => {
    api.get.mockImplementation((path: string) => {
      if (path === "/api/v1/me/courses") {
        return Promise.resolve({
          data: {
            items: [course()],
            totals: { enrolled: 1, inProgress: 0, completed: 0, lessonsCompleted: 0 },
          },
        });
      }
      if (path.startsWith("/api/v1/me/notifications")) return Promise.resolve({ data: [] });
      // Gamification, competency, certificates and paths: off for this academy.
      return Promise.reject(new Error("ENTITLEMENT_REQUIRED"));
    });

    const data = await loadLearnerDashboardData("Asha");

    expect(api.get).toHaveBeenCalledWith("/api/v1/me/notifications?kind=announcement&limit=1");
    expect(data.courses?.[0]?.title).toBe("Candlestick basics");
    expect(data.gamification).toBeNull();
    expect(data.readiness).toBeNull();
    expect(data.mastery).toEqual([]);
    expect(data.certificates).toEqual([]);
    expect(data.announcement).toBeNull();
  });

  it("reads the level from the learner's level progress", async () => {
    api.get.mockImplementation((path: string) => {
      if (path === "/api/v1/me/gamification") {
        return Promise.resolve({
          data: {
            xpTotal: 70,
            weeklyXp: 10,
            levelProgress: {
              levelNumber: 1,
              xpIntoLevel: 70,
              xpForNextLevel: 100,
              progressPct: 70,
            },
          },
        });
      }
      if (path === "/api/v1/me/streaks") {
        return Promise.resolve({
          data: { items: [{ streakKey: "daily_learning", currentCount: 2 }] },
        });
      }
      return Promise.reject(new Error("unavailable"));
    });

    const data = await loadLearnerDashboardData(null);

    expect(data.courses).toBeNull();
    expect(data.gamification).toEqual({
      level: { levelNumber: 1, xpIntoLevel: 70, xpForNextLevel: 100, progressPct: 70 },
      xpTotal: 70,
      weeklyXp: 10,
      streakDays: 2,
    });
  });
});
