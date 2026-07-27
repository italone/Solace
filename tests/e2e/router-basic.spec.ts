import { expect, test } from "@playwright/test";

test("navigates the router example", async ({ page }) => {
  await page.goto("http://127.0.0.1:5178");

  await expect(page.locator("#home-view")).toHaveText("home");

  await page.locator("#user-link").click();
  await expect(page.locator("#user-view")).toHaveText("user: 42 tab: profile");

  await page.locator("#missing-link").click();
  await expect(page.locator("#not-found-view")).toHaveText("not found");
});
