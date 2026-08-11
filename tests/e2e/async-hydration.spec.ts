import { expect, test } from "@playwright/test";

test("hydrates an async root without replacing server DOM", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("http://127.0.0.1:6179");

  const app = page.locator("#app");
  await expect(app).toHaveAttribute("data-hydrated", "true");
  await expect(app).toHaveAttribute("data-node-reused", "true");
  await page.locator("#async-counter").click();
  await expect(page.locator("#async-counter")).toHaveText("count: 1");
  expect(consoleErrors).toEqual([]);
});
