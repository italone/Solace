import { expect, test } from "@playwright/test";

test("increments the basic counter", async ({ page }) => {
  await page.goto("/");

  const counter = page.locator("#counter");
  await expect(counter).toHaveText("count: 0");

  await counter.click();

  await expect(counter).toHaveText("count: 1");
});
