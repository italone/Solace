import { defineConfig, devices } from "@playwright/test";

import { createPlaywrightWebServerEnv, sanitizePlaywrightProcessEnv } from "./playwright.env";

sanitizePlaywrightProcessEnv();

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "devtools-extension.spec.ts",
  webServer: [
    {
      command: "pnpm exec vite examples/basic-counter --host 127.0.0.1 --port 6174",
      env: createPlaywrightWebServerEnv(),
      url: "http://127.0.0.1:6174",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm exec vite preview examples/devtools-extension --host 127.0.0.1 --port 6177",
      env: createPlaywrightWebServerEnv(),
      url: "http://127.0.0.1:6177/panel.html",
      reuseExistingServer: !process.env.CI,
    },
  ],
  use: {
    baseURL: "http://127.0.0.1:6174",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
