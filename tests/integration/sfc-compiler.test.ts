import { describe, expect, it } from "vitest";

import { createApp, nextTick } from "../../src/index";
import App from "../fixtures/SfcCounter.solace";

describe("SFC compiler integration", () => {
  it("mounts a counter SFC and reacts to click", async () => {
    const container = document.createElement("div");
    createApp(App).mount(container);

    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.textContent?.trim()).toContain("count: 0");

    button?.click();
    await nextTick();

    expect(button?.textContent?.trim()).toContain("count: 1");
  });
});
