import { expect, test } from "@playwright/test";

test("panel Components tab renders a relayed component tree with updates", async ({ browser }) => {
  const page = await browser.newPage();

  await page.goto("http://127.0.0.1:6177/panel.html", { waitUntil: "commit" });
  await page.waitForFunction(
    () => Boolean(document.querySelector('[data-testid="panel-tabs"]')),
    undefined,
    { timeout: 20000 },
  );

  const relay = (event: Record<string, unknown>) =>
    page.evaluate((payload) => {
      window.postMessage({ type: "devtools:event", event: payload }, window.location.origin);
    }, event);

  await relay({ type: "component:mount", id: 1, name: "App", parentId: null });
  await relay({ type: "component:mount", id: 2, name: "Child", parentId: 1 });
  await relay({ type: "component:mount", id: 3, name: "Grandchild", parentId: 2 });
  await relay({ type: "component:update", id: 2, name: "Child", parentId: 1 });

  await page.getByTestId("panel-tabs").getByRole("button", { name: "Components" }).click();
  const tree = page.getByTestId("component-tree");
  await expect(tree).toContainText("App #1");
  await expect(tree).toContainText("Child #2");
  await expect(tree).toContainText("Grandchild #3");
  await expect(tree.locator(".component-node-updated")).toHaveCount(1);

  await relay({ type: "component:unmount", id: 2, name: "Child", parentId: 1 });
  await expect(tree).not.toContainText("Child #2");
  await expect(tree).not.toContainText("Grandchild #3");
  await expect(tree).toContainText("App #1");

  await page.close();
});
