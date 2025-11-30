import { test, expect } from "@playwright/test";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test.describe("UUID page", () => {
  test("loads successfully", async ({ page }) => {
    const response = await page.goto("/uuid");
    expect(response?.status()).toBe(200);
  });

  test("displays a valid UUID v4", async ({ page }) => {
    await page.goto("/uuid");
    const uuidText = await page.locator("code").textContent();
    expect(uuidText).toMatch(UUID_REGEX);
  });

  test("generates a new UUID on refresh", async ({ page }) => {
    await page.goto("/uuid");
    const firstUuid = await page.locator("code").textContent();

    await page.reload();
    const secondUuid = await page.locator("code").textContent();

    expect(firstUuid).toMatch(UUID_REGEX);
    expect(secondUuid).toMatch(UUID_REGEX);
    expect(firstUuid).not.toBe(secondUuid);
  });
});
