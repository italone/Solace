import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import { renderToStream } from "../../../src/server";
import { collectStream } from "./stream-test-utils";

const manifest = {
  "src/main.ts": { file: "assets/main.js", css: ["assets/main.css"] },
};

describe("renderToStream asset options", () => {
  it("enqueues asset tags after content and before close", async () => {
    const streamed = await collectStream(
      renderToStream(() => h("p", null, "x"), { manifest, clientEntry: "src/main.ts" }),
    );
    expect(streamed).toContain("<p>x</p>");
    expect(streamed).toContain('<script type="module" src="/assets/main.js"></script>');
    expect(streamed.indexOf("<p>x</p>")).toBeLessThan(streamed.indexOf("assets/main.js"));
  });

  it("emits asset tags before the router snapshot script", async () => {
    const routes = [{ path: "/", name: "home", component: () => h("p", null, "home") }];
    const streamed = await collectStream(
      renderToStream(() => h("div", null, "y"), {
        manifest,
        clientEntry: "src/main.ts",
        router: { url: "/", routes, identifyRecord: (r: { name?: string }) => r.name ?? "r" },
      }),
    );
    expect(streamed.indexOf("assets/main.js")).toBeLessThan(
      streamed.indexOf("__solace-router-snapshot"),
    );
  });

  it("rejects manifest without clientEntry synchronously", () => {
    expect(() => renderToStream(() => h("p", null, "x"), { manifest } as never)).toThrow(
      "SSR manifest and clientEntry must be provided together",
    );
  });

  it("composes with out-of-order mode", async () => {
    const streamed = await collectStream(
      renderToStream(() => h("p", null, "x"), {
        manifest,
        clientEntry: "src/main.ts",
        mode: "out-of-order",
      }),
    );
    expect(streamed).toContain("assets/main.js");
  });
});
