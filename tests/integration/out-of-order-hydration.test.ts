import { describe, expect, it } from "vitest";

import { Fragment, createApp, defineAsyncComponent, h, ref } from "../../src";
import { renderToStream } from "../../src/server";

async function collectStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let out = "";
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

// jsdom does not execute scripts inserted via innerHTML; run them explicitly.
function executeInlineScripts(html: string): void {
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/gu)) {
    new Function(match[1])();
  }
}

describe("out-of-order streaming hydration", () => {
  it("replaces boundaries in the DOM and hydrates the final markup", async () => {
    const AsyncPart = defineAsyncComponent({
      loader: async () => () => h("em", { id: "late" }, "resolved"),
      fallback: h("p", null, "loading…"),
    });
    const count = ref(0);
    const App = () =>
      h(Fragment, null, [
        h("button", { id: "inc", onClick: () => (count.value += 1) }, `count: ${count.value}`),
        h(AsyncPart),
      ]);

    const html = await collectStream(renderToStream(App, { mode: "out-of-order" }));

    // The replacement scripts must come after the markers.
    expect(html).toContain("so:b:1");
    expect(html).toContain("so:r:1");
    expect(html.indexOf("so:r:1")).toBeGreaterThan(html.indexOf("so:b:1"));

    const container = document.createElement("div");
    // Strip script tags (jsdom will not execute them from innerHTML; we run
    // them explicitly below with the container already attached) and the
    // `so:r:N` observability text chunks, which are stream telemetry, not DOM.
    container.innerHTML = html
      .replace(/<script>[\s\S]*?<\/script>/gu, "")
      .replace(/so:r:\d+/gu, "");
    document.body.appendChild(container);

    executeInlineScripts(html);

    expect(container.querySelector("#late")?.textContent).toBe("resolved");
    expect(container.textContent).not.toContain("loading…");

    await createApp(App).hydrateAsync(container);
    (container.querySelector("#inc") as HTMLButtonElement).click();
    await Promise.resolve();
    expect(container.querySelector("#inc")?.textContent).toContain("count: 1");
  });
});
