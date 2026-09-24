import { test, expect } from "@playwright/test";
import { loginWithCredentials } from "../helpers/auth";
import { waitForClickHandler, waitForSubmitHandler } from "../helpers/hydration";

test.use({ baseURL: "http://login.fixture.test" });

test("login waits for the form boundary before filling or submitting", async ({ page }) => {
  await page.route("http://login.fixture.test/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<body data-early-inputs="0" data-early-submissions="0" data-submissions="0">
      <form method="post"><label>Email<input name="email"></label>
      <label>Password<input name="password" type="password"></label>
      <button type="submit">Sign In</button></form>
      <script>
        document.body.__reactProps$fixture = {};
        const form = document.querySelector('form');
        const ready = () => typeof form.__reactProps$fixture?.onSubmit === 'function';
        form.addEventListener('input', () => {
          if (!ready()) document.body.dataset.earlyInputs++;
        });
        form.addEventListener('submit', event => {
          event.preventDefault();
          document.body.dataset.submissions++;
          if (!ready()) document.body.dataset.earlySubmissions++;
          else history.pushState({}, '', '/dashboard');
        });
      </script></body>`,
    }),
  );
  const login = loginWithCredentials(page, "fixture@example.test", "fixture-only");
  // Retain the original rejection while preventing teardown from creating an unhandled promise.
  void login.catch(() => {});
  try {
    const form = page.locator("form");
    await expect(form).toBeVisible();
    // Deliberately hold the form boundary after the body has hydrated.
    await page.waitForTimeout(300);
    await expect(page.locator("body")).toHaveAttribute("data-early-inputs", "0");
    await expect(page.locator("body")).toHaveAttribute("data-early-submissions", "0");
    await form.evaluate((element) => {
      Object.assign(element, { __reactProps$fixture: { onSubmit: () => {} } });
    });
    await login;
    await expect(page).toHaveURL("http://login.fixture.test/dashboard");
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue("fixture@example.test");
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue("fixture-only");
    await expect(page.locator("body")).toHaveAttribute("data-submissions", "1");
  } finally {
    await page.close();
    await login.catch(() => {});
  }
});

test("form readiness rejects absent and non-function handlers within its bound", async ({
  page,
}) => {
  test.setTimeout(10000);
  await page.setContent('<form><button type="submit">Sign In</button></form>');
  const form = page.locator("form");
  await expect(waitForSubmitHandler(form, 250)).rejects.toThrow("submit handler must be ready");
  await form.evaluate((element) => {
    Object.assign(element, {
      __reactFiber$fixture: {},
      __reactProps$fixture: { onSubmit: "pending" },
    });
  });
  await expect(waitForSubmitHandler(form, 250)).rejects.toThrow("submit handler must be ready");
});

test("click readiness still requires the clicked control's own function", async ({ page }) => {
  test.setTimeout(10000);
  await page.setContent("<button>Action</button>");
  const button = page.getByRole("button", { name: "Action" });
  await expect(waitForClickHandler(button, 250)).rejects.toThrow("click handler must be ready");
  await button.evaluate((element) => {
    Object.assign(element, { __reactProps$fixture: { onClick: () => {} } });
  });
  await waitForClickHandler(button, 250);
});
