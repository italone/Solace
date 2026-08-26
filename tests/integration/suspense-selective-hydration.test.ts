import { describe, expect, it } from "vitest";

import { Fragment, createApp, defineAsyncComponent, h, ref } from "../../src";
import { renderToStream } from "../../src/server";

describe("selective hydration round-trip", () => {
  it("buffers a click before boundary readiness and replays it after", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const count = ref(0);
    // The streamed HTML for an unresolved boundary contains only the fallback,
    // so the interactive element must live in the ready (shell) part; that is
    // exactly the shape selective hydration exists for.
    const AsyncBody = () => h("p", { id: "late" }, "loaded");
    const AsyncPart = defineAsyncComponent({
      loader: () => gate.then(() => Promise.resolve(AsyncBody)),
      fallback: h("p", null, "loading…"),
    });
    const App = () =>
      h(Fragment, null, [
        h("button", { id: "inc", onClick: () => (count.value += 1) }, `count: ${count.value}`),
        h(AsyncPart),
      ]);

    // The stream stays open until the boundary resolves, and the gate holds
    // that resolution; read just the flushed prefix (shell + fallback), which
    // the renderer enqueues before it starts waiting on pending boundaries.
    const decoder = new TextDecoder();
    const reader = renderToStream(App, { mode: "out-of-order" }).getReader();
    let html = "";
    while (!html.includes("loading…")) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    // Strip any replacement scripts/telemetry markers that made it into the
    // flushed prefix so the fallback stays in the DOM — this simulates
    // hydrating while the boundary is still unresolved.
    const container = document.createElement("div");
    container.innerHTML = html.replace(/<!--so:r:\d+-->|<script>[\s\S]*?<\/script>/gu, "");
    document.body.appendChild(container);

    const hydration = createApp(App).hydrateAsync(container, { selective: true });
    await Promise.resolve();

    // The click lands while the boundary is still unresolved: the buffer
    // intercepts it, so the handler must not fire yet.
    const button = container.querySelector("#inc") as HTMLButtonElement;
    expect(button).not.toBeNull();
    button.click();
    expect(button.textContent).toContain("count: 0");

    release!();
    void reader.cancel();
    await hydration;

    expect(container.textContent).not.toContain("loading…");
    expect(container.querySelector("#late")?.textContent).toBe("loaded");
    // Exactly one replayed click — a double fire would show 2, a lost one 0.
    expect(container.querySelector("#inc")?.textContent).toContain("count: 1");
  });
});
