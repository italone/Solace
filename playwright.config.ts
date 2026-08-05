import { defineConfig, devices } from "@playwright/test";

import { createPlaywrightWebServerEnv, sanitizePlaywrightProcessEnv } from "./playwright.env";

sanitizePlaywrightProcessEnv();

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["browser-benchmark.spec.ts", "devtools-extension.spec.ts"],
  webServer: [
    {
      command: "pnpm exec vite examples/basic-counter --host 127.0.0.1 --port 6174",
      env: createPlaywrightWebServerEnv(),
      url: "http://127.0.0.1:6174",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm exec vite examples/todo-app --host 127.0.0.1 --port 6175",
      env: createPlaywrightWebServerEnv(),
      url: "http://127.0.0.1:6175",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm exec vite examples/large-list --host 127.0.0.1 --port 6176",
      env: createPlaywrightWebServerEnv(),
      url: "http://127.0.0.1:6176",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm exec vite examples/router-basic --host 127.0.0.1 --port 6178",
      env: createPlaywrightWebServerEnv(),
      url: "http://127.0.0.1:6178",
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
