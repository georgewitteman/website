import { test, expect } from "@playwright/test";

test.describe("Microwave Time Calculator", () => {
  test("loads successfully", async ({ page }) => {
    const response = await page.goto("/microwave");
    expect(response?.status()).toBe(200);
  });

  test("displays initial calculated time with default values", async ({
    page,
  }) => {
    await page.goto("/microwave");

    // Default values: box wattage 1100, your wattage 900, 1 min 0 sec, power 10
    // Result should be displayed on initial load
    await expect(page.getByText(/Your Time:/)).toBeVisible();
    await expect(page.getByText(/min.*sec/)).toBeVisible();
  });

  test("calculates time when form is submitted", async ({ page }) => {
    await page.goto("/microwave");

    await page.locator("#bm").fill("2");
    await page.locator("#bs").fill("30");
    await page.getByRole("button", { name: "Calculate" }).click();

    // Should show result after submission
    await expect(page.locator("text=Your Time:")).toBeVisible();
    // Check the paragraph containing the result
    const resultParagraph = page.locator("p:has-text('Your Time:')");
    const resultText = await resultParagraph.textContent();
    expect(resultText).toContain("min");
    expect(resultText).toContain("sec");
  });

  test("loads values from URL parameters", async ({ page }) => {
    await page.goto("/microwave?bw=1000&w=800");

    await expect(page.locator("#bw")).toHaveValue("1000");
    await expect(page.locator("#w")).toHaveValue("800");
  });

  test("updates URL when form is submitted", async ({ page }) => {
    await page.goto("/microwave");

    await page.locator("#bw").fill("1200");
    await page.getByRole("button", { name: "Calculate" }).click();

    await expect(page).toHaveURL(/bw=1200/);
  });

  test("preserves all form values in URL after submission", async ({
    page,
  }) => {
    await page.goto("/microwave");

    await page.locator("#bw").fill("1000");
    await page.locator("#bm").fill("3");
    await page.locator("#bs").fill("45");
    await page.locator("#bp").fill("8");
    await page.locator("#w").fill("850");
    await page.getByRole("button", { name: "Calculate" }).click();

    await expect(page).toHaveURL(/bw=1000/);
    await expect(page).toHaveURL(/bm=3/);
    await expect(page).toHaveURL(/bs=45/);
    await expect(page).toHaveURL(/bp=8/);
    await expect(page).toHaveURL(/w=850/);
  });

  test("reset link clears URL parameters", async ({ page }) => {
    await page.goto("/microwave?bw=1000&w=800&bm=5");

    await page.getByRole("link", { name: "Reset" }).click();

    await expect(page).toHaveURL("/microwave");
    // Should have default values
    await expect(page.locator("#bw")).toHaveValue("1100");
    await expect(page.locator("#w")).toHaveValue("900");
  });

  test("has navigation link back to home", async ({ page }) => {
    await page.goto("/microwave");
    await expect(page.locator('a[href="/"]')).toBeVisible();
  });

  test("shows in navigation header", async ({ page }) => {
    await page.goto("/microwave");
    await expect(page.locator('nav a[href="/microwave"]')).toBeVisible();
  });

  test("has active class in navigation when on page", async ({ page }) => {
    await page.goto("/microwave");
    const microwaveLink = page.locator('nav a[href="/microwave"]');
    await expect(microwaveLink).toHaveClass(
      "header-nav-link header-nav-link-active",
    );
  });
});
