import { randomUUID } from "node:crypto";
import { test, expect } from "../fixtures/axe";
import { loginWithCredentials } from "../helpers/auth";
import { requiredCredential } from "../helpers/env";
import { waitForHydration } from "../helpers/hydration";
import { scenario } from "../helpers/scenario";

test.describe("J07 review changes", () => {
  test("returns an independently submitted course to draft with a persisted review note", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(150_000);
    scenario();
    const title = `Browser review ${randomUUID()}`;
    const note = "Add a worked example before publishing.";
    const authorContext = await browser.newContext({ baseURL });
    try {
      const author = await authorContext.newPage();
      await loginWithCredentials(
        author,
        requiredCredential("E2E_INSTRUCTOR_EMAIL"),
        requiredCredential("E2E_INSTRUCTOR_PASSWORD"),
      );
      const creation = await author.request.post("/api/v1/courses", {
        data: { title, description: "Independent review fixture" },
        headers: { "idempotency-key": randomUUID() },
      });
      expect(creation.status()).toBe(200);
      const { data: course } = (await creation.json()) as { data: { id: string } };
      const module = await author.request.post(`/api/v1/courses/${course.id}/modules`, {
        data: { title: "Review chapter" },
        headers: { "idempotency-key": randomUUID() },
      });
      expect(module.status()).toBe(200);
      const submission = await author.request.post(`/api/v1/courses/${course.id}/publish`, {
        data: {},
        headers: { "idempotency-key": randomUUID() },
      });
      expect(submission.status()).toBe(200);
      const { data: submitted } = (await submission.json()) as {
        data: { workflowTransitionId: string; status: string };
      };
      expect(submitted.status).toBe("REVIEW");
      await loginWithCredentials(
        page,
        requiredCredential("E2E_ADMIN_EMAIL"),
        requiredCredential("E2E_ADMIN_PASSWORD"),
      );
      await page.goto("/admin/review");
      await waitForHydration(page);
      await page.getByRole("button").filter({ hasText: title }).click();
      await page.getByLabel(/^Review note/).fill(note);
      const transition = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
            `/api/v1/workflows/${submitted.workflowTransitionId}/transition` &&
          response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Request changes", exact: true }).click();
      const returned = await transition;
      expect(returned.status()).toBe(200);
      expect(returned.request().postDataJSON()).toMatchObject({ action: "return", comment: note });
      await expect(
        page.getByRole("button").filter({ hasText: title }),
        "Returned course must leave the review queue",
      ).toHaveCount(0);
      await page.reload();
      await expect(page.getByRole("button").filter({ hasText: title })).toHaveCount(0);
      const persisted = await author.request.get(`/api/v1/courses/${course.id}?view=studio`);
      expect(persisted.status()).toBe(200);
      expect(await persisted.json()).toMatchObject({ data: { id: course.id, status: "DRAFT" } });
      const history = await page.request.get(
        `/api/v1/workflows/history?targetType=course&targetId=${course.id}`,
      );
      expect(history.status()).toBe(200);
      expect(await history.json()).toMatchObject({
        data: {
          items: expect.arrayContaining([
            expect.objectContaining({ action: "return", reason: note, toState: "DRAFT" }),
          ]),
        },
      });
    } finally {
      await authorContext.close();
    }
  });
});
