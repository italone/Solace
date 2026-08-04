import { describe, expect, it, vi } from "vitest";

import { h, inject } from "../../../src";

const renderToStringMock = vi.hoisted(() =>
  vi.fn(() => ({
    html: "<p>rendered</p>",
    styles: ["scoped.css"],
  })),
);

vi.mock("../../../src/server/render-to-string", () => ({
  renderToString: renderToStringMock,
}));

import { generateStaticSite } from "../../../src/server";

describe("generateStaticSite", () => {
  it("renders routes in order and passes shell inputs", () => {
    const shell = vi.fn(({ path, body, styles, context, assets }) => {
      return `<!doctype html><html data-path="${path}" data-title="${String(context.title ?? "")}"><head>${assets.modulePreloads.join("")}${assets.stylesheets.join("")}${assets.scripts.join("")}</head><body>${body}<style>${styles.join(",")}</style></body></html>`;
    });

    const pages = generateStaticSite({
      routes: [
        { path: "/", source: h("h1", null, "home"), context: { title: "Home" } },
        {
          path: "/about",
          source: () => h("p", null, "about"),
          provides: new Map([["theme", "dark"]]),
        },
      ],
      shell,
    });

    expect(renderToStringMock).toHaveBeenCalledTimes(2);
    expect(renderToStringMock).toHaveBeenNthCalledWith(
      1,
      h("h1", null, "home"),
      expect.objectContaining({ context: { title: "Home" } }),
    );
    expect(renderToStringMock).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      expect.objectContaining({ provides: new Map([["theme", "dark"]]) }),
    );
    expect(shell).toHaveBeenNthCalledWith(1, {
      path: "/",
      body: "<p>rendered</p>",
      styles: ["scoped.css"],
      assets: { modulePreloads: [], stylesheets: [], scripts: [] },
      context: { title: "Home" },
    });
    expect(shell).toHaveBeenNthCalledWith(2, {
      path: "/about",
      body: "<p>rendered</p>",
      styles: ["scoped.css"],
      assets: { modulePreloads: [], stylesheets: [], scripts: [] },
      context: {},
    });
    expect(pages).toEqual({
      pages: [
        {
          path: "/",
          body: "<p>rendered</p>",
          html: '<!doctype html><html data-path="/" data-title="Home"><head></head><body><p>rendered</p><style>scoped.css</style></body></html>',
          styles: ["scoped.css"],
        },
        {
          path: "/about",
          body: "<p>rendered</p>",
          html: '<!doctype html><html data-path="/about" data-title=""><head></head><body><p>rendered</p><style>scoped.css</style></body></html>',
          styles: ["scoped.css"],
        },
      ],
    });
  });

  it("defaults to raw body output and rejects invalid route lists", () => {
    expect(() =>
      generateStaticSite({
        routes: [],
      }),
    ).toThrow(TypeError);

    expect(() =>
      generateStaticSite({
        routes: [{ path: 42, source: h("p", null, "bad") }],
      } as never),
    ).toThrow(/SSG route path must be a string/);

    expect(() =>
      generateStaticSite({
        routes: [{ path: "about", source: h("p", null, "bad") }],
      }),
    ).toThrow(TypeError);

    expect(() =>
      generateStaticSite({
        routes: [
          { path: "/", source: h("p", null, "one") },
          { path: "/", source: h("p", null, "two") },
        ],
      }),
    ).toThrow(TypeError);
  });

  it("rejects invalid route context and provides values", () => {
    for (const context of ["title", [], null, new Date()]) {
      expect(() =>
        generateStaticSite({
          routes: [{ path: "/", source: h("p", null, "bad"), context: context as never }],
        }),
      ).toThrow(TypeError("SSG route context must be a plain object"));
    }

    expect(() =>
      generateStaticSite({
        routes: [{ path: "/", source: h("p", null, "bad"), provides: {} as never }],
      }),
    ).toThrow(TypeError("SSG route provides must be a Map"));
  });

  it("rejects sparse route lists", () => {
    const routes = [{ path: "/", source: h("p", null, "home") }];
    routes.length = 2;

    expect(() => generateStaticSite({ routes })).toThrow(
      TypeError("SSG routes must not be sparse"),
    );
  });

  it("passes resolved manifest assets into each shell call", () => {
    const observedAssets: unknown[] = [];
    const shell = vi.fn(({ body, assets }) => {
      observedAssets.push({
        modulePreloads: [...assets.modulePreloads],
        stylesheets: [...assets.stylesheets],
        scripts: [...assets.scripts],
      });
      assets.modulePreloads.push("mutated");
      assets.stylesheets.push("mutated");
      assets.scripts.push("mutated");

      return `<!doctype html><html><head>${assets.modulePreloads.join("")}${assets.stylesheets.join("")}${assets.scripts.join("")}</head><body>${body}</body></html>`;
    });

    const site = generateStaticSite({
      routes: [
        { path: "/", source: h("p", null, "home") },
        { path: "/about", source: h("p", null, "about") },
      ],
      manifest: {
        "/src/main.ts": {
          file: "assets/main.js",
          css: ["assets/main.css"],
          imports: ["_vendor.js"],
        },
        "_vendor.js": {
          file: "assets/vendor.js",
          css: ["assets/vendor.css"],
        },
      },
      clientEntry: "/src/main.ts",
      base: "/app/",
      shell,
    });

    const resolvedAssets = {
      modulePreloads: ['<link rel="modulepreload" href="/app/assets/vendor.js">'],
      stylesheets: [
        '<link rel="stylesheet" href="/app/assets/vendor.css">',
        '<link rel="stylesheet" href="/app/assets/main.css">',
      ],
      scripts: ['<script type="module" src="/app/assets/main.js"></script>'],
    };

    expect(observedAssets).toEqual([resolvedAssets, resolvedAssets]);
    expect(site.pages[0].html).toContain('<link rel="modulepreload" href="/app/assets/vendor.js">');
    expect(site.pages[0].html).toContain('<link rel="stylesheet" href="/app/assets/vendor.css">');
    expect(site.pages[0].html).toContain(
      '<script type="module" src="/app/assets/main.js"></script>',
    );
    expect(site.pages[1].html).not.toContain("mutatedmutated");
  });

  it("keeps raw body output unchanged when manifest assets are resolved without a shell", () => {
    const site = generateStaticSite({
      routes: [{ path: "/", source: h("p", null, "home") }],
      manifest: {
        "/src/main.ts": {
          file: "assets/main.js",
          css: ["assets/main.css"],
        },
      },
      clientEntry: "/src/main.ts",
    });

    expect(site.pages[0]).toEqual({
      path: "/",
      body: "<p>rendered</p>",
      html: "<p>rendered</p>",
      styles: ["scoped.css"],
    });
  });

  it("rejects partial manifest and deferred router integration options", () => {
    expect(() =>
      generateStaticSite({
        routes: [{ path: "/", source: h("p", null, "home") }],
        manifest: {},
      } as never),
    ).toThrow(/SSG manifest integration requires both manifest and clientEntry/);

    expect(() =>
      generateStaticSite({
        routes: [{ path: "/", source: h("p", null, "home") }],
        clientEntry: "/src/main.ts",
      } as never),
    ).toThrow(/SSG manifest integration requires both manifest and clientEntry/);

    expect(() =>
      generateStaticSite({
        routes: [{ path: "/", source: h("p", null, "home") }],
        router: {},
      } as never),
    ).toThrow(/Router-aware SSG integration is deferred/);
  });

  it("rejects deferred route-level manifest and router integration options", () => {
    expect(() =>
      generateStaticSite({
        routes: [{ path: "/", source: h("p", null, "home"), manifest: {} }],
      } as never),
    ).toThrow(/SSG route manifest integration is deferred/);

    expect(() =>
      generateStaticSite({
        routes: [{ path: "/", source: h("p", null, "home"), clientEntry: "/src/main.ts" }],
      } as never),
    ).toThrow(/SSG route manifest integration is deferred/);

    expect(() =>
      generateStaticSite({
        routes: [{ path: "/", source: h("p", null, "home"), router: {} }],
      } as never),
    ).toThrow(/Router-aware SSG route integration is deferred/);
  });

  it("threads app-level provides into route rendering", () => {
    const ThemeKey = Symbol("theme");
    const Page = () => {
      const theme = inject(ThemeKey, "light");
      return h("p", null, String(theme));
    };

    generateStaticSite({
      routes: [
        {
          path: "/theme",
          source: h(Page),
          provides: new Map([[ThemeKey, "dark"]]),
        },
      ],
    });

    expect(renderToStringMock).toHaveBeenCalledWith(
      h(Page),
      expect.objectContaining({
        provides: new Map([[ThemeKey, "dark"]]),
      }),
    );
  });

  it("isolates shell mutations from collected styles and route context", () => {
    const routeContext = { title: "Home" };
    const observedShellInput: {
      path?: string;
      body?: string;
      styles?: string[];
      title?: unknown;
    } = {};
    const shell = vi.fn(({ body, styles, context }) => {
      observedShellInput.path = "/";
      observedShellInput.body = body;
      observedShellInput.styles = [...styles];
      observedShellInput.title = context.title;
      (styles as string[]).push("mutated");
      (context as Record<string, unknown>).title = "Changed";

      return `<!doctype html><html data-title="${String(context.title)}"><body>${body}<style>${styles.join(",")}</style></body></html>`;
    });

    const site = generateStaticSite({
      routes: [{ path: "/", source: h("h1", null, "home"), context: routeContext }],
      shell,
    });

    expect(routeContext).toEqual({ title: "Home" });
    expect(observedShellInput).toEqual({
      path: "/",
      body: "<p>rendered</p>",
      styles: ["scoped.css"],
      title: "Home",
    });
    expect(site.pages[0].styles).toEqual(["scoped.css"]);
    expect(site.pages[0].html).toContain('data-title="Changed"');
    expect(site.pages[0].html).toContain("scoped.css,mutated");
  });
});
