import { describe, expect, it, vi } from "vitest";

import { h, useStyle } from "../../src";
import { generateStaticSite } from "../../src/server";

describe("SSG style integration", () => {
  it("passes collected server style tags to the shell unchanged", () => {
    const Page = () => {
      useStyle("page", ".page { color: blue; }");
      return h("main", { class: "page" }, "page");
    };
    const shell = vi.fn(({ body, styles }) => {
      return `<!doctype html><html><head>${styles.join("")}</head><body>${body}</body></html>`;
    });

    const site = generateStaticSite({
      routes: [{ path: "/", source: h(Page) }],
      shell,
    });

    const expectedStyles = ['<style data-s-id="page">.page { color: blue; }</style>'];
    expect(shell).toHaveBeenCalledWith({
      path: "/",
      body: '<main class="page">page</main>',
      styles: expectedStyles,
      context: {},
    });
    expect(site.pages[0]).toEqual({
      path: "/",
      body: '<main class="page">page</main>',
      html: '<!doctype html><html><head><style data-s-id="page">.page { color: blue; }</style></head><body><main class="page">page</main></body></html>',
      styles: expectedStyles,
    });
  });
});
