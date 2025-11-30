import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("loads successfully", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
  });

  test("contains navigation links", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('a[href="/icloud-private-relay"]')).toBeVisible();
    await expect(
      page.locator('a[href="/microwave-time-calculator.html"]')
    ).toBeVisible();
  });
});
