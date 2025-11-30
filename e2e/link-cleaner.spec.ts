import { test, expect } from "@playwright/test";

test.describe("Link Cleaner", () => {
  test("loads successfully", async ({ page }) => {
    const response = await page.goto("/link-cleaner.html");
    expect(response?.status()).toBe(200);
  });

  test("cleans UTM parameters from URL", async ({ page }) => {
    await page.goto("/link-cleaner.html");

    await page
      .locator("#long_url")
      .fill(
        "https://example.com/page?utm_source=twitter&utm_medium=social&id=123",
      );

    const shortUrl = page.locator("#short_url a");
    await expect(shortUrl).toHaveText("https://example.com/page?id=123");
  });

  test("cleans Amazon URLs to short format", async ({ page }) => {
    await page.goto("/link-cleaner.html");

    await page
      .locator("#long_url")
      .fill(
        "https://www.amazon.com/Some-Product-Name/dp/B08N5WRWNW/ref=sr_1_1?keywords=test",
      );

    const shortUrl = page.locator("#short_url a");
    await expect(shortUrl).toHaveText("https://www.amazon.com/dp/B08N5WRWNW");
  });

  test("cleans Google search URLs", async ({ page }) => {
    await page.goto("/link-cleaner.html");

    await page
      .locator("#long_url")
      .fill("https://www.google.com/search?q=test+query&source=hp&ei=abc123");

    const shortUrl = page.locator("#short_url a");
    await expect(shortUrl).toHaveText("https://google.com/search?q=test+query");
  });

  test("removes trailing slashes", async ({ page }) => {
    await page.goto("/link-cleaner.html");

    await page.locator("#long_url").fill("https://example.com/page/");

    const shortUrl = page.locator("#short_url a");
    await expect(shortUrl).toHaveText("https://example.com/page");
  });

  test("shows copy button when URL is entered", async ({ page }) => {
    await page.goto("/link-cleaner.html");

    const copyButton = page.locator("#copy_short_url");
    await expect(copyButton).toHaveClass(/hidden/);

    await page.locator("#long_url").fill("https://example.com");

    await expect(copyButton).not.toHaveClass(/hidden/);
  });

  test("hides copy button when URL is cleared", async ({ page }) => {
    await page.goto("/link-cleaner.html");

    await page.locator("#long_url").fill("https://example.com");
    const copyButton = page.locator("#copy_short_url");
    await expect(copyButton).not.toHaveClass(/hidden/);

    await page.locator("#long_url").fill("");
    await expect(copyButton).toHaveClass(/hidden/);
  });

  test("handles invalid URLs gracefully", async ({ page }) => {
    await page.goto("/link-cleaner.html");

    await page.locator("#long_url").fill("not a valid url");

    const shortUrl = page.locator("#short_url");
    await expect(shortUrl).toHaveText("");
  });

  test("cleans fbclid parameter", async ({ page }) => {
    await page.goto("/link-cleaner.html");

    await page
      .locator("#long_url")
      .fill("https://example.com/article?fbclid=abc123&title=test");

    const shortUrl = page.locator("#short_url a");
    await expect(shortUrl).toHaveText("https://example.com/article?title=test");
  });

  test("has navigation link back to home", async ({ page }) => {
    await page.goto("/link-cleaner.html");
    await expect(page.locator('a[href="/"]')).toBeVisible();
  });
});
