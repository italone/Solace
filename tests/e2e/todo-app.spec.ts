import { expect, test } from "@playwright/test";

test("adds, toggles, and deletes todos", async ({ page }) => {
  await page.goto("http://127.0.0.1:5175");

  await expect(page.locator("#todo-list li")).toHaveCount(2);

  await page.locator("#todo-input").fill("Write e2e test");
  await page.locator("#add-todo").click();

  const added = page.locator('[data-testid="todo-3"]');
  await expect(added).toContainText("open: Write e2e test");

  await added.locator('input[type="checkbox"]').check();
  await expect(added).toContainText("done: Write e2e test");

  await added.locator("button").click();
  await expect(page.locator('[data-testid="todo-3"]')).toHaveCount(0);
});
