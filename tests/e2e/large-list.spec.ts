import { expect, test } from "@playwright/test";

test("renders 10000 rows and updates one row", async ({ page }) => {
  await page.goto("http://127.0.0.1:5176");

  await expect(page.locator("#rows > div")).toHaveCount(10000);
  await expect(page.locator('[data-row="1"]')).toContainText("selected");

  await page.locator("#select-middle").click();

  await expect(page.locator("#selected-row")).toHaveText("selected: 5000");
  await expect(page.locator('[data-row="5000"]')).toContainText("selected");
});
