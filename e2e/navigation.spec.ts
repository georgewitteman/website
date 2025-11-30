import { test, expect } from "@playwright/test";
test.describe("Navigation", () => {
  test("UUID link has active class on UUID page", async ({ page }) => {
    await page.goto("/uuid");
    const uuidLink = page.locator('a[href="/uuid"]');
    await expect(uuidLink).toHaveClass(
      "header-nav-link header-nav-link-active",
    );
  });

  test("Echo link has active class on Echo page", async ({ page }) => {
    await page.goto("/echo");
    const echoLink = page.locator('a[href="/echo"]');
    await expect(echoLink).toHaveClass(
      "header-nav-link header-nav-link-active",
    );
  });

  test("UUID link does not have active class on other pages", async ({
    page,
  }) => {
    await page.goto("/echo");
    const uuidLink = page.locator('a[href="/uuid"]');
    await expect(uuidLink).toHaveClass("header-nav-link ");
  });

  test("Echo link does not have active class on other pages", async ({
    page,
  }) => {
    await page.goto("/uuid");
    const echoLink = page.locator('a[href="/echo"]');
    await expect(echoLink).toHaveClass("header-nav-link ");
  });
});
