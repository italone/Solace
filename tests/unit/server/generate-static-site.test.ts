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
    const shell = vi.fn(({ path, body, styles, context }) => {
      return `<!doctype html><html data-path="${path}" data-title="${String(context.title ?? "")}"><body>${body}<style>${styles.join(",")}</style></body></html>`;
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
      context: { title: "Home" },
    });
    expect(shell).toHaveBeenNthCalledWith(2, {
      path: "/about",
      body: "<p>rendered</p>",
      styles: ["scoped.css"],
      context: {},
    });
    expect(pages).toEqual({
      pages: [
        {
          path: "/",
          body: "<p>rendered</p>",
          html: '<!doctype html><html data-path="/" data-title="Home"><body><p>rendered</p><style>scoped.css</style></body></html>',
          styles: ["scoped.css"],
        },
        {
          path: "/about",
          body: "<p>rendered</p>",
          html: '<!doctype html><html data-path="/about" data-title=""><body><p>rendered</p><style>scoped.css</style></body></html>',
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
});
