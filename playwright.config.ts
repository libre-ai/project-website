import { defineConfig, devices } from "@playwright/test";

// The e2e run serves dist/ through the production server in its local demo form (server/demo.ts):
// the security headers and the CSP are those of production, the waitlist writes to an in-memory
// PostgreSQL and its messages to a local outbox the waitlist suite reads. A project that cannot
// launch is reported as a failure rather than skipped.
export const OUTBOX = ".demo/outbox-e2e";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "*.e2e.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: "line",
  // Visual baselines are per platform: a macOS rendering is never compared with a Linux one.
  snapshotPathTemplate: "{testDir}/__screenshots__/{platform}/{projectName}/{arg}{ext}",
  use: {
    baseURL: "http://localhost:8080",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `bun server/demo-main.ts --port 8080 --site dist --outbox ${OUTBOX}`,
    url: "http://localhost:8080/",
    reuseExistingServer: false,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    {
      name: "chromium-no-js",
      use: { ...devices["Desktop Chrome"], javaScriptEnabled: false },
    },
  ],
});
