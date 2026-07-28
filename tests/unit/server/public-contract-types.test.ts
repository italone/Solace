import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import type { GenerateStaticSiteOptions, RenderToStringOptions } from "../../../src/server";

function acceptSSGOptions(options: GenerateStaticSiteOptions): GenerateStaticSiteOptions {
  return options;
}

function acceptRenderOptions(options: RenderToStringOptions): RenderToStringOptions {
  return options;
}

acceptSSGOptions({
  routes: [{ path: "/", source: h("p", null, "home") }],
});

acceptRenderOptions({
  context: { title: "Home" },
});

// @ts-expect-error production manifest integration is not part of the SSG public contract
acceptSSGOptions({ routes: [{ path: "/", source: h("p") }], manifest: {} });

// @ts-expect-error client entry inference is not part of the SSG public contract
acceptSSGOptions({ routes: [{ path: "/", source: h("p") }], clientEntry: "/src/main.ts" });

// @ts-expect-error router-aware SSG adapters are deferred
acceptSSGOptions({ routes: [{ path: "/", source: h("p") }], router: {} });

// @ts-expect-error renderToString does not read production manifests
acceptRenderOptions({ manifest: {} });

// @ts-expect-error renderToString does not infer client entries
acceptRenderOptions({ clientEntry: "/src/main.ts" });

// @ts-expect-error router-aware SSR integration is deferred
acceptRenderOptions({ router: {} });

describe("server public contract types", () => {
  it("keeps manifest and router integration out of the public SSR/SSG options", () => {
    expect(true).toBe(true);
  });
});
