import { test, expect } from "../fixtures/axe";
import { loginWithCredentials } from "../helpers/auth";
import { requiredCredential } from "../helpers/env";
import { waitForHydration } from "../helpers/hydration";
import { scenario } from "../helpers/scenario";
import { coldRouteNavigationOptions } from "../helpers/navigation";
import { probePhase } from "../helpers/probe-phase";

test.describe("J02 learner enrollment and persisted lesson progress", () => {
  test("enrolls, resumes saved progress, and completes a lesson with the keyboard", async ({
    page,
  }) => {
    const fixture = scenario();
    const coursePath = `/courses/${fixture.courseId}`;
    const lessonPath = `${coursePath}/lessons/${fixture.lessonId}`;
    const progressPath = `/api/v1/lessons/${fixture.lessonId}/progress`;
    await probePhase("J02 login", () =>
      loginWithCredentials(
        page,
        requiredCredential("E2E_LEARNER_EMAIL"),
        requiredCredential("E2E_LEARNER_PASSWORD"),
        "/courses",
      ),
    );
    await expect(page.getByRole("main")).toBeVisible();

    const beforeEnrollment = await probePhase("J02 course before enrollment", () =>
      page.request.get(`/api/v1/courses/${fixture.courseId}`),
    );
    test.info().annotations.push({
      type: "j02-course-status",
      description: JSON.stringify({ phase: "before", status: beforeEnrollment.status() }),
    });
    expect(beforeEnrollment.status()).toBe(200);
    expect(await beforeEnrollment.json()).toMatchObject({
      data: { id: fixture.courseId, enrollmentStatus: "not_enrolled" },
    });

    await probePhase("J02 enrollment", async () => {
      await page.goto("/courses");
      await page.locator(`a[href="${coursePath}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${coursePath}$`));
      await waitForHydration(page);
      await page.getByRole("button", { name: "Enroll", exact: true }).click();
      const enrollmentResponse = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/v1/enrollments" &&
          response.request().method() === "POST",
      );
      await page
        .getByRole("dialog", { name: "Confirm enrollment" })
        .getByRole("button", { name: "Confirm enrollment", exact: true })
        .click();
      const enrolled = await enrollmentResponse;
      expect(enrolled.status()).toBe(200);
      expect(enrolled.request().postDataJSON()).toEqual({ courseId: fixture.courseId });
      expect(await enrolled.json()).toMatchObject({
        data: { courseId: fixture.courseId, status: "active", created: true },
      });
      await expect(page.getByText(/You are enrolled/)).toBeVisible();
    });

    const afterEnrollment = await probePhase("J02 course after enrollment", () =>
      page.request.get(`/api/v1/courses/${fixture.courseId}`),
    );
    test.info().annotations.push({
      type: "j02-course-status",
      description: JSON.stringify({ phase: "after", status: afterEnrollment.status() }),
    });
    expect(afterEnrollment.status()).toBe(200);
    expect(await afterEnrollment.json()).toMatchObject({
      data: { id: fixture.courseId, enrollmentStatus: "enrolled" },
    });

    const firstProgressResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === progressPath &&
        response.request().method() === "POST" &&
        response.request().postDataJSON()?.completed === false,
    );
    // Follow the published outline: a missing learner link is a product failure.
    await page.locator(`a[href="${lessonPath}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${lessonPath}$`), coldRouteNavigationOptions());
    const firstProgress = await firstProgressResponse;
    expect(firstProgress.status()).toBe(200);
    const firstSaved = (await firstProgress.json()) as {
      data: { status: string; progressPct: number; positionSeconds: number };
    };
    expect(firstSaved.data.status).toBe("in_progress");
    expect(firstSaved.data.positionSeconds).toBe(
      firstProgress.request().postDataJSON().positionSeconds,
    );
    // Timer callbacks may be delayed on a busy CI runner. Verify real partial
    // progress and its submitted position rather than one exact wall-clock tick.
    expect(firstSaved.data.positionSeconds).toBeGreaterThanOrEqual(30);
    expect(firstSaved.data.positionSeconds).toBeLessThan(600);
    expect(firstSaved.data.progressPct).toBeGreaterThanOrEqual(5);
    expect(firstSaved.data.progressPct).toBeLessThan(100);

    // Leaving the player stops its timer; the next read must come from storage.
    await page.goto(coursePath);
    const savedLesson = await page.request.get(`/api/v1/lessons/${fixture.lessonId}`);
    expect(savedLesson.status()).toBe(200);
    const savedBody = (await savedLesson.json()) as {
      data: { progress: { status: string; progressPct: number; positionSeconds: number } };
    };
    expect(savedBody.data.progress.status).toBe("in_progress");
    expect(savedBody.data.progress.progressPct).toBeGreaterThanOrEqual(5);
    expect(savedBody.data.progress.positionSeconds).toBeGreaterThanOrEqual(30);
    await page.locator(`a[href="${lessonPath}"]`).click();
    await expect(
      page.getByText(`Resume at ${savedBody.data.progress.positionSeconds}s`, { exact: true }),
    ).toBeVisible();

    await waitForHydration(page);
    const markComplete = page.getByRole("button", { name: "Mark complete", exact: true });
    await markComplete.focus();
    await expect(markComplete).toBeFocused();
    const completionResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === progressPath &&
        response.request().method() === "POST" &&
        response.request().postDataJSON()?.completed === true,
    );
    await page.keyboard.press("Enter");
    const completed = await completionResponse;
    expect(completed.status()).toBe(200);
    expect(await completed.json()).toMatchObject({
      data: { status: "completed", progressPct: 100 },
    });

    await page.reload();
    await expect(
      page.getByText("Status: completed · 100% complete", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Lesson completed" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark complete", exact: true })).toHaveCount(0);

    const persistedLesson = await page.request.get(`/api/v1/lessons/${fixture.lessonId}`);
    expect(persistedLesson.status()).toBe(200);
    expect(await persistedLesson.json()).toMatchObject({
      data: { id: fixture.lessonId, progress: { status: "completed", progressPct: 100 } },
    });
    const courseProgress = await page.request.get(`/api/v1/courses/${fixture.courseId}/progress`);
    expect(courseProgress.status()).toBe(200);
    expect(await courseProgress.json()).toMatchObject({
      data: {
        items: [
          {
            membershipId: fixture.learnerMembershipId,
            progressPct: 100,
            completedLessons: 1,
            totalLessons: 1,
          },
        ],
      },
    });
  });
});
