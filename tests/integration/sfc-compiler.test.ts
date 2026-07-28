import { describe, expect, it } from "vitest";

import { createApp, nextTick } from "../../src/index";
import App from "../fixtures/SfcCounter.solace";

describe("SFC compiler integration", () => {
  it("mounts a counter SFC and injects exactly one scoped style tag", async () => {
    document.head.innerHTML = "";
    const container = document.createElement("div");

    createApp(App).mount(container);

    const styleTags = document.head.querySelectorAll("style[data-s-id]");
    expect(styleTags).toHaveLength(1);
    expect(styleTags[0]?.textContent).toContain(".counter");

    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.textContent?.trim()).toContain("count: 0");

    button?.click();
    await nextTick();

    expect(button?.textContent?.trim()).toContain("count: 1");
  });
});
