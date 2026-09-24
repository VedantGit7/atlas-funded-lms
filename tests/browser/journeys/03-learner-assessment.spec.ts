import { test, expect } from "../fixtures/axe";
import { loginWithCredentials } from "../helpers/auth";
import { requiredCredential } from "../helpers/env";
import { waitForHydration } from "../helpers/hydration";
import { scenario } from "../helpers/scenario";
import { coldRouteNavigationOptions } from "../helpers/navigation";
import { probePhase } from "../helpers/probe-phase";

test.describe("J03 learner assessment lifecycle", () => {
  test("autosaves an answer, restores it on reload, and persists a graded submission", async ({
    page,
  }) => {
    const fixture = scenario();
    await probePhase("J03 login", () =>
      loginWithCredentials(
        page,
        requiredCredential("E2E_LEARNER_EMAIL"),
        requiredCredential("E2E_LEARNER_PASSWORD"),
        `/assessments/${fixture.assessmentId}`,
      ),
    );
    const attemptId = await probePhase("J03 start", async () => {
      await page.goto(`/assessments/${fixture.assessmentId}`);
      await expect(page.getByText("Items: 1", { exact: true })).toBeVisible();
      await waitForHydration(page);
      const startResponse = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
            `/api/v1/assessments/${fixture.assessmentId}/attempts` &&
          response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Start attempt", exact: true }).click();
      const started = await startResponse;
      expect(started.status()).toBe(200);
      expect(started.request().postDataJSON()).toEqual({});
      const startBody = (await started.json()) as {
        data: { id: string; assessmentId: string; status: string };
      };
      expect(startBody.data).toMatchObject({
        assessmentId: fixture.assessmentId,
        status: "STARTED",
      });
      const attemptId = startBody.data.id;
      expect(attemptId).toMatch(/^[\da-f-]{36}$/i);
      await expect(page).toHaveURL(new RegExp(`/attempts/${attemptId}$`));
      await expect(
        page.getByRole("heading", { name: "Assessment attempt", exact: true }),
      ).toBeVisible();
      await waitForHydration(page);

      return attemptId;
    });
    await probePhase("J03 autosave", async () => {
      const answerResponse = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/v1/attempts/${attemptId}/answers` &&
          response.request().method() === "POST",
      );
      await page.getByRole("radio", { name: "Paris", exact: true }).check();
      const saved = await answerResponse;
      expect(saved.status()).toBe(200);
      expect(saved.request().postDataJSON()).toMatchObject({
        answerJson: { selectedOptionId: fixture.correctOptionId, latencyMs: expect.any(Number) },
      });
      expect(await saved.json()).toMatchObject({
        data: { assessmentItemId: fixture.assessmentItemId, savedAt: expect.any(String) },
      });
      await expect(page.getByText("Autosave: Saved", { exact: true })).toBeVisible();

      const savedAttempt = await page.request.get(`/api/v1/attempts/${attemptId}`);
      expect(savedAttempt.status()).toBe(200);
      expect(await savedAttempt.json()).toMatchObject({
        data: {
          id: attemptId,
          status: "STARTED",
          items: [
            {
              assessmentItemId: fixture.assessmentItemId,
              savedAnswer: { selectedOptionId: fixture.correctOptionId },
            },
          ],
        },
      });
    });
    await probePhase("J03 reload", async () => {
      await page.reload();
      await expect(page.getByRole("radio", { name: "Paris", exact: true })).toBeChecked();
      await expect(page.getByRole("radio", { name: "London", exact: true })).not.toBeChecked();
      await waitForHydration(page);
    });
    await probePhase("J03 submit", async () => {
      const submitButton = page.getByRole("button", { name: "Submit attempt", exact: true });
      await submitButton.focus();
      await expect(submitButton).toBeFocused();
      page.once("dialog", async (dialog) => {
        expect(dialog.type()).toBe("confirm");
        expect(dialog.message()).toBe(
          "Submit attempt? You cannot change answers after submission.",
        );
        await dialog.accept();
      });
      const submitResponse = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/v1/attempts/${attemptId}/submit` &&
          response.request().method() === "POST",
      );
      await page.keyboard.press("Enter");
      const submitted = await submitResponse;
      expect(submitted.status()).toBe(200);
      expect(submitted.request().postDataJSON()).toEqual({});
      expect(await submitted.json()).toMatchObject({
        data: {
          id: attemptId,
          status: "GRADED",
          scorePercent: 100,
          passed: true,
          requiresManualGrading: false,
        },
      });
    });
    await probePhase("J03 result", async () => {
      await expect(page).toHaveURL(
        new RegExp(`/attempts/${attemptId}/result$`),
        coldRouteNavigationOptions(),
      );
      await expect(
        page.getByRole("heading", { name: "Attempt result", exact: true }),
      ).toBeVisible();
      await expect(page.getByText("GRADED", { exact: true })).toBeVisible();
      await expect(page.getByText("100%", { exact: true })).toBeVisible();
      await expect(page.getByText("Passed", { exact: true })).toBeVisible();

      await page.reload();
      await expect(page.getByText("GRADED", { exact: true })).toBeVisible();
      await expect(page.getByText("100%", { exact: true })).toBeVisible();
      await expect(page.getByText("Passed", { exact: true })).toBeVisible();
      const persistedAttempt = await page.request.get(`/api/v1/attempts/${attemptId}`);
      expect(persistedAttempt.status()).toBe(200);
      expect(await persistedAttempt.json()).toMatchObject({
        data: {
          id: attemptId,
          status: "GRADED",
          scorePercent: 100,
          passed: true,
          requiresManualGrading: false,
          submittedAt: expect.any(String),
          items: [
            {
              assessmentItemId: fixture.assessmentItemId,
              savedAnswer: { selectedOptionId: fixture.correctOptionId },
            },
          ],
        },
      });
    });
  });
});
