import { expect, test } from "@playwright/test";

test("builds extension classic scripts without module imports", async ({ request }) => {
  const bridgeScript = await (await request.get("http://127.0.0.1:6177/bridge.js")).text();
  const contentScript = await (await request.get("http://127.0.0.1:6177/content-script.js")).text();

  expect(bridgeScript).not.toMatch(/^import/m);
  expect(contentScript).not.toMatch(/^import/m);
});

test("captures relayed DevTools events in the extension panel workflow", async ({
  browser,
  page,
}) => {
  const appPage = await browser.newPage();

  await page.goto("http://127.0.0.1:6177/panel.html", { waitUntil: "commit" });
  await page.waitForFunction(
    () => Boolean(document.querySelector('[data-testid="timeline-list"]')),
    undefined,
    { timeout: 20000 },
  );
  await appPage.goto("http://127.0.0.1:6174/", { waitUntil: "domcontentloaded" });

  const counter = appPage.locator("#counter");
  await expect(counter).toHaveText("count: 0");
  await counter.click();
  await expect(counter).toHaveText("count: 1");

  await page.evaluate(() => {
    window.postMessage(
      {
        type: "devtools:event",
        event: { type: "component:update", id: 1, name: "Counter" },
      },
      window.location.origin,
    );
  });
  await page.evaluate(() => {
    window.postMessage(
      {
        type: "devtools:event",
        event: {
          type: "scheduler:flush",
          queuedJobs: 1,
          dedupedJobs: 0,
          durationMs: 2,
        },
      },
      window.location.origin,
    );
  });

  await expect(page.getByTestId("timeline-list")).toContainText("component:update");
  await expect(page.getByTestId("timeline-list")).toContainText("scheduler:flush");

  await page.getByTestId("family-filters").getByRole("button", { name: "scheduler" }).click();
  await expect(page.getByTestId("timeline-list")).not.toContainText("component:update");
  await expect(page.getByTestId("timeline-list")).toContainText("scheduler:flush");

  await page.getByTestId("family-filters").getByRole("button", { name: "scheduler" }).click();
  await expect(page.getByTestId("timeline-list")).toContainText("component:update");

  await page.getByRole("button", { name: "Pause" }).click();
  await page.evaluate(() => {
    window.postMessage(
      {
        type: "devtools:event",
        event: { type: "component:mount", id: 2, name: "IgnoredWhilePaused" },
      },
      window.location.origin,
    );
  });
  await expect(page.getByTestId("timeline-list")).not.toContainText("IgnoredWhilePaused");

  await page.getByRole("button", { name: "Resume" }).click();
  await page.evaluate(() => {
    window.postMessage(
      {
        type: "devtools:event",
        event: { type: "component:mount", id: 3, name: "CapturedAfterResume" },
      },
      window.location.origin,
    );
  });
  await expect(page.getByTestId("timeline-list")).toContainText("CapturedAfterResume");

  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByTestId("timeline-list").locator("li")).toHaveCount(0);

  await appPage.close();
});
