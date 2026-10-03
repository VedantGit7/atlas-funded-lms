import { randomUUID } from "node:crypto";
import { test, expect } from "../fixtures/axe";
import { loginWithCredentials } from "../helpers/auth";
import { requiredCredential } from "../helpers/env";
import { waitForChangeHandler, waitForClickHandler, waitForHydration } from "../helpers/hydration";
import { coldRouteNavigationOptions } from "../helpers/navigation";
import { scenario } from "../helpers/scenario";

test.describe("J06 instructor authoring and independent review", () => {
  test("creates a draft, submits it, and publishes it through a separate reviewer", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(process.env["BROWSER_E2E_DEV"] === "1" ? 300_000 : 180_000);
    scenario();
    const title = `Browser authored ${randomUUID()}`;
    await loginWithCredentials(
      page,
      requiredCredential("E2E_INSTRUCTOR_EMAIL"),
      requiredCredential("E2E_INSTRUCTOR_PASSWORD"),
      "/studio/courses",
    );
    await waitForHydration(page);
    await expect(page.getByRole("heading", { name: "Courses", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Create", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "New Course", exact: true });
    await dialog.getByLabel(/^Title/).fill(title);
    await dialog.getByLabel(/^Short introduction/).fill("A browser-authored course for review.");
    await dialog
      .getByLabel(/^Course description/)
      .fill("This draft was created through the instructor interface.");
    const creation = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v1/courses" &&
        response.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    const created = await creation;
    expect(created.status()).toBe(200);
    const { data: course } = (await created.json()) as { data: { id: string; status: string } };
    expect(course.status).toBe("DRAFT");
    await expect(page).toHaveURL(
      new RegExp(`/studio/courses/${course.id}(?:/dashboard)?$`),
      coldRouteNavigationOptions(),
    );
    await page.goto(`/studio/courses/${course.id}/editor`);
    await waitForHydration(page);
    const addSection = page.getByRole("button", { name: "Add Section", exact: true });
    await waitForClickHandler(addSection);
    await addSection.click();
    const chapter = page.getByRole("dialog", { name: "Add Chapter" });
    await chapter.getByLabel(/^Title/).fill("Browser chapter");
    const moduleCreation = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/v1/courses/${course.id}/modules` &&
        response.request().method() === "POST",
    );
    await chapter.getByRole("button", { name: "Create", exact: true }).click();
    expect((await moduleCreation).status()).toBe(200);
    await expect(page.getByText("1. Browser chapter", { exact: true })).toBeVisible();
    await page.goto(`/studio/courses/${course.id}/settings?section=publish-course`);
    await waitForHydration(page);
    const live = page
      .getByRole("radiogroup", { name: "Course visibility" })
      .getByRole("radio", { name: /^Live/ });
    // The publish panel is a streamed client boundary: body hydration does not mean this radio
    // can change yet, and a click that lands first is silently lost.
    await expect(live).toBeEnabled();
    await waitForChangeHandler(live);
    await page
      .getByRole("radiogroup", { name: "Course visibility" })
      .getByText("Live", { exact: true })
      .click();
    await expect(live).toBeChecked();
    const submission = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/v1/courses/${course.id}/publish` &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("radiogroup", { name: "Course visibility" })
      .locator("..")
      .getByRole("button", { name: "Publish", exact: true })
      .click();
    const submitted = await submission;
    expect(submitted.status()).toBe(200);
    const { data: review } = (await submitted.json()) as {
      data: { status: string; workflowTransitionId: string };
    };
    expect(review.status).toBe("REVIEW");
    const persistedReview = await page.request.get(`/api/v1/courses/${course.id}?view=studio`);
    expect(persistedReview.status()).toBe(200);
    expect(await persistedReview.json()).toMatchObject({
      data: { id: course.id, title, status: "REVIEW" },
    });
    const reviewerContext = await browser.newContext({ baseURL });
    try {
      const reviewer = await reviewerContext.newPage();
      await loginWithCredentials(
        reviewer,
        requiredCredential("E2E_ADMIN_EMAIL"),
        requiredCredential("E2E_ADMIN_PASSWORD"),
        "/admin/review",
      );
      await waitForHydration(reviewer);
      await reviewer.getByRole("button").filter({ hasText: title }).click();
      await reviewer.getByRole("button", { name: "Approve & publish…", exact: true }).click();
      const approval = reviewer.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
            `/api/v1/workflows/${review.workflowTransitionId}/transition` &&
          response.request().method() === "POST",
      );
      await reviewer
        .getByRole("alertdialog", { name: "Approve and publish?" })
        .getByRole("button", { name: "Confirm publish", exact: true })
        .click();
      const approved = await approval;
      expect(approved.status()).toBe(200);
      expect(approved.request().postDataJSON()).toMatchObject({ action: "approve" });
      await expect(reviewer.getByRole("button").filter({ hasText: title })).toHaveCount(0);
      await reviewer.reload();
      await expect(reviewer.getByRole("button").filter({ hasText: title })).toHaveCount(0);
    } finally {
      await reviewerContext.close();
    }
    const published = await page.request.get(`/api/v1/courses/${course.id}?view=studio`);
    expect(published.status()).toBe(200);
    expect(await published.json()).toMatchObject({
      data: { id: course.id, title, status: "PUBLISHED" },
    });
    const learnerContext = await browser.newContext({ baseURL });
    try {
      const learner = await learnerContext.newPage();
      await loginWithCredentials(
        learner,
        requiredCredential("E2E_LEARNER_EMAIL"),
        requiredCredential("E2E_LEARNER_PASSWORD"),
        `/courses/${course.id}`,
      );
      await expect(learner.getByRole("heading", { name: title, exact: true })).toBeVisible();
      const learnerCourse = await learner.request.get(`/api/v1/courses/${course.id}`);
      expect(learnerCourse.status()).toBe(200);
      expect(await learnerCourse.json()).toMatchObject({ data: { id: course.id, title } });
    } finally {
      await learnerContext.close();
    }
  });
});
