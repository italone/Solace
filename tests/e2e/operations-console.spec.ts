import { expect, test } from "@playwright/test";

const operationsConsoleUrl = "http://127.0.0.1:6180";

test("runs the desktop operations workflows", async ({ page }) => {
  await page.goto(operationsConsoleUrl);

  await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();

  await page.getByRole("link", { name: "Incidents" }).click();
  await page.getByRole("searchbox", { name: "Search incidents" }).fill("checkout");
  await expect(page.locator("[data-incident-id]")).toHaveCount(1);

  const incidentStatus = page.getByLabel("Status for INC-1042");
  await incidentStatus.selectOption("monitoring");
  await expect(incidentStatus).toHaveValue("monitoring");

  await page.getByRole("link", { name: /INC-1042/ }).click();
  await expect(
    page.getByRole("heading", { name: "INC-1042: Checkout latency spike" }),
  ).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "Monitoring" })).toBeVisible();
  await page.getByRole("link", { name: "Back to incidents" }).click();
  await expect(page.getByRole("heading", { name: "Incident queue" })).toBeVisible();

  await page.goto(`${operationsConsoleUrl}/#/legacy-incidents`);
  await expect(page.getByRole("heading", { name: "Incident queue" })).toBeVisible();

  await page.getByRole("link", { name: "Releases" }).click();
  await expect(page.getByRole("table", { name: "Release activity" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Dependency status unavailable");

  await page.goto(`${operationsConsoleUrl}/#/missing`);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("hydrates matching and recoverable operations summaries", async ({ page }) => {
  await page.goto(`${operationsConsoleUrl}/hydration.html`);

  await expect(page.locator("#matching-result")).toHaveText("server node reused");
  await expect(page.locator('style[data-s-id="operations-console-incident-summary"]')).toHaveCount(
    1,
  );

  await page.getByRole("button", { name: "Increment open incidents" }).click();
  await expect(page.locator("#matching-root")).toContainText("4");

  await expect(page.locator("#recovery-result")).toHaveText("mismatch recovered");
  await page.getByRole("button", { name: "Increment recovered count" }).click();
  await expect(page.locator("#recovery-root")).toContainText("2");
});

test.describe("mobile operations workflow", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps navigation and incident controls visible and usable", async ({ page }) => {
    await page.goto(operationsConsoleUrl);

    expect(await page.evaluate(() => document.body.scrollWidth > document.body.clientWidth)).toBe(
      false,
    );

    const navigation = page.getByLabel("Primary navigation");
    await expect(navigation).toBeVisible();
    await navigation.getByRole("link", { name: "Incidents" }).click();

    const search = page.getByRole("searchbox", { name: "Search incidents" });
    await expect(search).toBeVisible();
    await search.fill("checkout");
    await expect(page.locator("[data-incident-id]")).toHaveCount(1);
    expect(await page.evaluate(() => document.body.scrollWidth > document.body.clientWidth)).toBe(
      false,
    );

    const incidentTableScrollRegion = page.getByRole("region", {
      name: "Scrollable incident queue table",
    });
    await expect(incidentTableScrollRegion).toBeVisible();
    await expect(incidentTableScrollRegion).toHaveAttribute("tabindex", "0");

    const scrollRegionState = await incidentTableScrollRegion.evaluate((element) => ({
      clientWidth: element.clientWidth,
      overflowX: getComputedStyle(element).overflowX,
      scrollWidth: element.scrollWidth,
    }));
    expect(scrollRegionState.scrollWidth).toBeGreaterThan(scrollRegionState.clientWidth);
    expect(["auto", "scroll"]).toContain(scrollRegionState.overflowX);

    await incidentTableScrollRegion.focus();
    await expect(incidentTableScrollRegion).toBeFocused();
    await incidentTableScrollRegion.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    await expect
      .poll(() => incidentTableScrollRegion.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(0);

    const incidentStatus = page.getByLabel("Status for INC-1042");
    await incidentStatus.scrollIntoViewIfNeeded();
    await expect(incidentStatus).toBeVisible();
    await incidentStatus.focus();
    await expect(incidentStatus).toBeFocused();
    await incidentStatus.selectOption("monitoring");
    await expect(incidentStatus).toHaveValue("monitoring");
  });
});
