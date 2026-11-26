import { defineConfig, devices } from "@playwright/test";

// The e2e run serves dist/ through the production server in its local demo form (server/demo.ts):
// the security headers and the CSP are those of production, the waitlist writes to an in-memory
// PostgreSQL and its messages to a local outbox the waitlist suite reads. A project that cannot
// launch is reported as a failure rather than skipped.
export const OUTBOX = ".demo/outbox-e2e";
const PORT = process.env.PLAYWRIGHT_PORT ?? "8080";
if (!/^[1-9][0-9]{0,4}$/.test(PORT) || Number(PORT) > 65535) {
  throw new Error("PLAYWRIGHT_PORT must be a TCP port (1–65535)");
}
export const DEMO_ORIGIN = `http://localhost:${PORT}`;

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
    baseURL: DEMO_ORIGIN,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `bun server/demo-main.ts --port ${PORT} --site dist --outbox ${OUTBOX}`,
    url: `${DEMO_ORIGIN}/`,
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
