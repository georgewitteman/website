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
      /\d+% of the day/,
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

  test("tells you what to wear, and what to carry", async ({ page }) => {
    // Two decisions, not one: the outfit is for the warmest you will be, since
    // a shirt you are too hot in cannot be taken off; the layer covers the
    // coolest, since a jacket can.
    await page.goto("/weather");
    const verdict = page.locator(".weather-verdict");
    await expect(verdict).toContainText(
      /Wear .+(which holds up to \d\.\d \(-?\d+°\)|all day)/,
    );
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

    await page.locator(".weather-hero .weather-probe-trigger").first().click();
    await expect(tip).toBeVisible();
    await expect(tip).toContainText(/air \d+° · wind \d+ mph/);
  });

  test("the tooltip can be dismissed again", async ({ page }) => {
    // On a touch screen there is no way to un-hover, so a tooltip that opens
    // on tap and cannot be closed sits on top of the page it is explaining.
    // The pointer is parked away from the trigger between steps because on a
    // hover-capable browser :hover is a second, independent reason to show it
    // -- there, moving the mouse off is itself the dismissal.
    await page.goto("/weather");
    const trigger = page
      .locator(".weather-hero .weather-probe-trigger")
      .first();
    const tip = page.locator(".weather-hero .weather-probe-tip").first();

    await trigger.click();
    await expect(tip).toBeVisible();

    await trigger.click(); // tapping the same score again closes it
    await page.mouse.move(0, 0);
    await expect(tip).toBeHidden();

    await trigger.click();
    await expect(tip).toBeVisible();
    await page.locator(".weather-place-name").click(); // tapping elsewhere
    await page.mouse.move(0, 0);
    await expect(tip).toBeHidden();

    await trigger.click();
    await expect(tip).toBeVisible();
    await page.keyboard.press("Escape");
    await page.mouse.move(0, 0);
    await expect(tip).toBeHidden();
  });

  test("the nav bar fills the width and keeps its links on one line", async ({
    page,
  }) => {
    // Adding a sixth nav item used to squeeze the links until their text
    // wrapped and spilled past the right edge of the dark bar.
    await page.goto("/weather");
    const viewport = page.viewportSize();
    const header = await page.locator(".header").boundingBox();
    expect(header?.width ?? 0).toBeGreaterThanOrEqual(
      (viewport?.width ?? 0) - 1,
    );

    const weather = await page.locator('nav a[href="/weather"]').boundingBox();
    const cleaner = await page
      .locator('nav a[href="/link-cleaner.html"]')
      .boundingBox();
    expect(cleaner?.height ?? 0).toBeCloseTo(weather?.height ?? 0, 0);
  });

  test("shows a sun and shade reading for every hour", async ({ page }) => {
    await page.goto("/weather");
    await expect(page.getByRole("columnheader", { name: "Sun" })).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Shade" }),
    ).toBeVisible();
    expect(
      await page.locator(".weather-hours tbody tr").count(),
    ).toBeGreaterThan(6);
  });

  test("the hourly headings follow you down the table", async ({ page }) => {
    // Eighteen rows is more than a screenful. This also guards the table
    // against being put back into a scroll container, which would silently
    // stop `position: sticky` working at all.
    await page.goto("/weather");
    const headerHeight =
      (await page.locator(".header").boundingBox())?.height ?? 0;

    await page
      .locator(".weather-hours tbody tr")
      .last()
      .scrollIntoViewIfNeeded();
    const heading = await page
      .locator(".weather-hours thead th")
      .first()
      .boundingBox();
    const table = await page.locator(".weather-hours").boundingBox();

    expect(heading?.y ?? 0).toBeCloseTo(headerHeight, 0);
    expect(heading?.y ?? 0).toBeGreaterThan((table?.y ?? 0) + 50);
  });

  test("nothing overhangs the side of the page", async ({ page }) => {
    await page.goto("/weather");
    const overflow = await page.evaluate(
      "document.documentElement.scrollWidth - document.documentElement.clientWidth",
    );
    expect(overflow).toBeLessThanOrEqual(1);
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

  test("the look-up button keeps its label next to a long search term", async ({
    page,
  }) => {
    await page.goto("/weather?q=Green+brook+township");
    const button = page.getByRole("button", { name: "Look up" });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(40);
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
