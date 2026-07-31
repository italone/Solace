import { expect, test } from "@playwright/test";

test("navigates the router example", async ({ page }) => {
  await page.goto("http://127.0.0.1:6178");

  await expect(page.locator("#home-view")).toHaveText("home");

  await page.locator("#user-link").click();
  await expect(page.locator("#user-view")).toHaveText("user: 42 tab: profile");

  await page.locator("#legacy-link").click();
  await expect(page.locator("#home-view")).toHaveText("home");

  await page.locator("#dashboard-link").click();
  await expect(page.locator("#login-view")).toHaveText("login");

  await page.locator("#sign-in-button").click();
  await expect(page.locator("#dashboard-home-view")).toHaveText("dashboard home");

  await page.locator("#settings-link").click();
  await expect(page.locator("#settings-view")).toHaveText("settings");

  await page.locator("#report-link").click();
  await expect(page.locator("#lazy-report-view")).toHaveText("lazy report");

  await page.locator("#missing-link").click();
  await expect(page.locator("#not-found-view")).toHaveText("not found");
});
