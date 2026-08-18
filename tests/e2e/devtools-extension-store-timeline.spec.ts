import { expect, test } from "@playwright/test";

test("store timeline demo dispatches recordable store actions", async ({ browser }) => {
  const page = await browser.newPage();

  await page.goto("http://127.0.0.1:6177/store-timeline.html", { waitUntil: "domcontentloaded" });

  const counter = page.locator("#counter");
  await expect(counter).toHaveText("count: 0");
  await page.locator("#increment").click();
  await expect(counter).toHaveText("count: 1");
  await expect(page.locator("#recorded-actions")).toHaveText("recorded store actions: 1");

  await page.close();
});

test("panel store tab lists recorded store action timeline", async ({ browser }) => {
  const page = await browser.newPage();

  await page.goto("http://127.0.0.1:6177/panel.html", { waitUntil: "commit" });
  await page.waitForFunction(
    () => Boolean(document.querySelector('[data-testid="panel-tabs"]')),
    undefined,
    { timeout: 20000 },
  );

  // The panel records events relayed from the inspected origin. Relay the public
  // `store:action` summary shape emitted by the store timeline demo origin.
  await page.evaluate(() => {
    window.postMessage(
      {
        type: "devtools:event",
        event: { type: "store:action", name: "increment", status: "success", durationMs: 1.5 },
      },
      window.location.origin,
    );
  });

  await page.getByTestId("panel-tabs").getByRole("button", { name: "Store" }).click();
  const storeActions = page.getByTestId("store-actions");
  await expect(storeActions).toContainText("increment");
  await expect(storeActions).toContainText("success");

  // Switching back to the timeline view keeps the raw event list available.
  await page.getByTestId("panel-tabs").getByRole("button", { name: "Timeline" }).click();
  await expect(page.getByTestId("timeline-list")).toContainText("store:action");

  await page.close();
});
