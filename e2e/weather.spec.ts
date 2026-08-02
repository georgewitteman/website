import { test, expect } from "@playwright/test";

// These hit the live Open-Meteo API through the server, so they assert on
// structure and labels rather than on any particular temperature. The server
// caches each location for ten minutes, so only the first test pays for the
// upstream call.
test.describe("Weather", () => {
  test("loads successfully", async ({ page }) => {
    const response = await page.goto("/weather");
    expect(response?.status()).toBe(200);
  });

  test("defaults to the Inner Sunset", async ({ page }) => {
    await page.goto("/weather");
    await expect(
      page.getByRole("heading", { name: "Inner Sunset" }),
    ).toBeVisible();
  });

  test("leads with a single 0-10 score for the day", async ({ page }) => {
    await page.goto("/weather");
    await expect(
      page.locator(".weather-hero-value .weather-probe-trigger"),
    ).toHaveText(/^\d\.\d$/);
    await expect(page.locator(".weather-hero-share")).toHaveText(
      /for \d+% of it/,
    );
  });

  test("shows the cool and warm bounds either side of it", async ({ page }) => {
    await page.goto("/weather");
    await expect(page.getByText("coolest, out of the sun")).toBeVisible();
    await expect(page.getByText(/warmest, \d+ [AP]M/)).toBeVisible();
    await expect(
      page.locator(".weather-bound-value .weather-probe-trigger"),
    ).toHaveCount(2);
  });

  test("tells you what to wear", async ({ page }) => {
    await page.goto("/weather");
    await expect(page.getByText(/^Dress for \d\.\d —/)).toBeVisible();
  });

  test("colours each score by how it feels", async ({ page }) => {
    await page.goto("/weather");
    const chip = page.locator(".weather-hero .weather-probe-trigger").first();
    await expect(chip).toHaveClass(/weather-feel-([0-9]|10)\b/);
  });

  test("a score reveals the data behind it", async ({ page }) => {
    await page.goto("/weather");
    const tip = page.locator(".weather-hero .weather-probe-tip").first();
    await expect(tip).toBeHidden();

    // Tap is the mobile path; it focuses the button, which opens the tooltip.
    await page.locator(".weather-hero .weather-probe-trigger").first().click();
    await expect(tip).toBeVisible();
    await expect(tip).toContainText(/air \d+° · wind \d+ mph/);
  });

  test("explains what the 0-10 scale means", async ({ page }) => {
    await page.goto("/weather");
    await page.getByText("What the 0 to 10 means").click();
    await expect(page.locator(".weather-key-list li")).toHaveCount(11);
    await expect(page.getByText("perfect · about 60°")).toBeVisible();
  });

  test("shows a sun and shade reading for every hour", async ({ page }) => {
    await page.goto("/weather");
    await expect(
      page.getByRole("columnheader", { name: "In sun" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "In shade" }),
    ).toBeVisible();
    expect(
      await page.locator(".weather-hours tbody tr").count(),
    ).toBeGreaterThan(6);
  });

  test("marks sunset in the hourly view", async ({ page }) => {
    await page.goto("/weather");
    await expect(page.locator(".weather-row-sunset")).toContainText(
      /Sunset \d+:\d\d [AP]M/,
    );
  });

  test("compares today against yesterday", async ({ page }) => {
    await page.goto("/weather");
    await expect(
      page.getByRole("heading", { name: "Against yesterday" }),
    ).toBeVisible();
    await expect(
      page.getByRole("rowheader", { name: "Typical feel" }),
    ).toBeVisible();
  });

  test("is honest about the resolution of the data", async ({ page }) => {
    await page.goto("/weather");
    await expect(page.locator(".weather-resolution")).toContainText(
      /grid point used here is [\d.]+ mi/,
    );
  });

  test("switches to a pinned location", async ({ page }) => {
    await page.goto("/weather");
    await page.getByRole("link", { name: "Financial District" }).click();

    await expect(page).toHaveURL("/weather?loc=fidi");
    await expect(
      page.getByRole("heading", { name: "Financial District" }),
    ).toBeVisible();
  });

  test("the search form submits a place name", async ({ page }) => {
    await page.goto("/weather");
    await page.locator("#q").fill("Portland");
    await page.getByRole("button", { name: "Look up" }).click();

    // Only the URL is asserted: resolving the name needs the geocoding service
    // as well as the forecast, and a flaky upstream should not fail the suite.
    await expect(page).toHaveURL(/[?&]q=Portland/);
  });

  test("opens an arbitrary location by coordinates", async ({ page }) => {
    await page.goto("/weather?lat=45.5234&lon=-122.6762&name=Portland");
    await expect(page.getByRole("heading", { name: "Portland" })).toBeVisible();
  });

  test("shows in navigation header with active class", async ({ page }) => {
    await page.goto("/weather");
    const weatherLink = page.locator('nav a[href="/weather"]');
    await expect(weatherLink).toHaveClass(
      "header-nav-link header-nav-link-active",
    );
  });
});
