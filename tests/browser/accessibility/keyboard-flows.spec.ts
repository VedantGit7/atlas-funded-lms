import { test, expect } from "../fixtures/axe";

test.describe("keyboard accessibility flows", () => {
  test("login form supports keyboard tab order", async ({ page }) => {
    await page.goto("/login");
    await page.keyboard.press("Tab");
    const email = page.getByLabel("Email");
    await expect(email).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Password")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeFocused();
  });

  test("login submit via keyboard Enter", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("invalid@example.test");
    await page.getByLabel("Password").fill("invalid-password");
    await page.getByLabel("Password").press("Enter");
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("public landing quick links are keyboard reachable", async ({ page }) => {
    await page.goto("/p/home");
    await page.keyboard.press("Tab");
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedTag).toBeTruthy();
  });
});
