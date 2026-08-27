import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import { renderToString, renderToStringAsync } from "../../../src/server";

const manifest = {
  "src/main.ts": { file: "assets/main.js", css: ["assets/main.css"] },
};

describe("renderToString asset options", () => {
  it("appends asset tags after the content", () => {
    const result = renderToString(() => h("p", null, "x"), {
      manifest,
      clientEntry: "src/main.ts",
    });
    expect(result.html).toContain("<p>x</p>");
    expect(result.html).toContain('<link rel="stylesheet" href="/assets/main.css">');
    expect(result.html).toContain('<script type="module" src="/assets/main.js"></script>');
    expect(result.html.indexOf("<p>x</p>")).toBeLessThan(result.html.indexOf("assets/main.js"));
  });

  it("rejects manifest without clientEntry synchronously", () => {
    expect(() => renderToString(() => h("p", null, "x"), { manifest } as never)).toThrow(
      "SSR manifest and clientEntry must be provided together",
    );
  });
});

describe("renderToStringAsync asset options", () => {
  it("appends asset tags before the router snapshot script", async () => {
    const routes = [{ path: "/", name: "home", component: () => h("p", null, "home") }];
    const result = await renderToStringAsync(() => h("div", null, "y"), {
      manifest,
      clientEntry: "src/main.ts",
      router: { url: "/", routes, identifyRecord: (r: { name?: string }) => r.name ?? "r" },
    });
    expect(result.html).toContain("y");
    expect(result.html).toContain("assets/main.js");
    expect(result.html).toContain("__solace-router-snapshot");
    expect(result.html.indexOf("assets/main.js")).toBeLessThan(
      result.html.indexOf("__solace-router-snapshot"),
    );
  });

  it("rejects clientEntry without manifest", () => {
    return expect(
      renderToStringAsync(() => h("p", null, "x"), { clientEntry: "src/main.ts" } as never),
    ).rejects.toThrow("SSR manifest and clientEntry must be provided together");
  });
});
