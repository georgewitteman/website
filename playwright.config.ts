import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "Desktop Chrome",
      use: devices["Desktop Chrome"],
    },
    {
      name: "Desktop Firefox",
      use: devices["Desktop Firefox"],
    },
    {
      name: "Desktop Safari",
      use: devices["Desktop Safari"],
    },
    {
      name: "Mobile Chrome",
      use: devices["Pixel 5"],
    },
    {
      name: "Mobile Safari",
      use: devices["iPhone 12"],
    },
  ],
  webServer: {
    command: "cargo run",
    url: "http://localhost:8080",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
