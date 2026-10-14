import { defineConfig, devices } from "@playwright/test";

// The e2e run serves a dist/ built by src/build-site.ts (see README), over HTTP on 8080.
// Firefox and WebKit are not declared here: the browsers are not installed in this environment,
// and a project that cannot launch is reported as a failure rather than skipped.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "*.e2e.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://localhost:8080",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "python3 -m http.server 8080 --bind localhost --directory dist",
    url: "http://localhost:8080/",
    reuseExistingServer: false,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "chromium-no-js",
      use: { ...devices["Desktop Chrome"], javaScriptEnabled: false },
    },
  ],
});
