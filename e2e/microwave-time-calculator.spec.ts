import { test, expect } from "@playwright/test";

test.describe("Microwave Time Calculator", () => {
  test("loads successfully", async ({ page }) => {
    const response = await page.goto("/microwave-time-calculator.html");
    expect(response?.status()).toBe(200);
  });

  test("displays initial calculated time with default values", async ({
    page,
  }) => {
    await page.goto("/microwave-time-calculator.html");

    // Default values: box wattage 1100, your wattage 975, 1 min 0 sec, power 10
    await expect(page.locator("#result_time")).toHaveText("1 min 8 sec");
    await expect(page.locator("#result_power")).toHaveText("10");
  });

  test("recalculates time when box time changes", async ({ page }) => {
    await page.goto("/microwave-time-calculator.html");

    await page.locator("#box_minutes").fill("2");
    await page.locator("#box_seconds").fill("30");

    // Trigger input event
    await page.locator("#box_seconds").blur();

    const resultTime = await page.locator("#result_time").textContent();
    expect(resultTime).toContain("min");
    expect(resultTime).toContain("sec");
  });

  test("plus/minus buttons adjust box time", async ({ page }) => {
    await page.goto("/microwave-time-calculator.html");

    // Initial time is 1 min 0 sec = 60 seconds
    await page.locator("#plus_15_s").click();

    // Should now be 1 min 15 sec
    await expect(page.locator("#box_minutes")).toHaveValue("1");
    await expect(page.locator("#box_seconds")).toHaveValue("15");
  });

  test("plus/minus buttons adjust power", async ({ page }) => {
    await page.goto("/microwave-time-calculator.html");

    await expect(page.locator("#box_power")).toHaveValue("10");

    await page.locator("#minus_1_power").click();
    await expect(page.locator("#box_power")).toHaveValue("9");

    await page.locator("#plus_1_power").click();
    await expect(page.locator("#box_power")).toHaveValue("10");
  });

  test("plus/minus buttons adjust wattage", async ({ page }) => {
    await page.goto("/microwave-time-calculator.html");

    await expect(page.locator("#box_wattage")).toHaveValue("1100");

    await page.locator("#plus_box_wattage").click();
    await expect(page.locator("#box_wattage")).toHaveValue("1125");

    await page.locator("#minus_box_wattage").click();
    await expect(page.locator("#box_wattage")).toHaveValue("1100");
  });

  test("loads values from URL parameters", async ({ page }) => {
    await page.goto(
      "/microwave-time-calculator.html?box_wattage=1000&your_wattage=800",
    );

    await expect(page.locator("#box_wattage")).toHaveValue("1000");
    await expect(page.locator("#your_wattage")).toHaveValue("800");
  });

  test("updates URL when values change", async ({ page }) => {
    await page.goto("/microwave-time-calculator.html");

    await page.locator("#box_wattage").fill("1200");
    await page.locator("#box_wattage").blur();

    await expect(page).toHaveURL(/box_wattage=1200/);
  });

  test("has navigation link back to home", async ({ page }) => {
    await page.goto("/microwave-time-calculator.html");
    await expect(page.locator('a[href="/"]')).toBeVisible();
  });
});
