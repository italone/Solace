import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

async function readDoc(path: string): Promise<string> {
  return readFile(path, "utf8");
}

describe("public contract documentation", () => {
  it("keeps release gates and deferred beta boundaries aligned", async () => {
    const [
      readme,
      readmeZh,
      api,
      apiZh,
      packageUsage,
      projectStatus,
      projectStatusZh,
      compatibility,
      compatibilityZh,
    ] = await Promise.all([
      readDoc("readme.md"),
      readDoc("readme.zh-CN.md"),
      readDoc("docs/api.md"),
      readDoc("docs/api.zh-CN.md"),
      readDoc("docs/package-usage.md"),
      readDoc("docs/project-status.md"),
      readDoc("docs/project-status.zh-CN.md"),
      readDoc("docs/compatibility.md"),
      readDoc("docs/compatibility.zh-CN.md"),
    ]);

    expect(readme).toContain("## Public Contract Gate");
    expect(readmeZh).toContain("## 公开契约门禁");
    expect(readme).toContain("[Compatibility and deprecation policy](./docs/compatibility.md)");
    expect(readmeZh).toContain("[兼容性与弃用策略](./docs/compatibility.zh-CN.md)");
    expect(api).toContain("## Deferred Beta Boundaries");
    expect(apiZh).toContain("## Deferred Beta 边界");
    expect(packageUsage).toContain(
      "Do not treat route `meta` as authentication or permission enforcement",
    );
    expect(packageUsage).toContain("Router-level `auth` and `permissions` options");
    expect(packageUsage).toContain("route record fields");
    expect(packageUsage).toContain("are rejected");
    expect(packageUsage).toContain("browser extension QA");
    expect(packageUsage).toContain("stale-port handling");
    expect(api).toContain("Router options or route records that use");
    expect(api).toContain("`auth` or `permissions` fields are rejected");
    expect(readme).toContain("Router `auth` and `permissions` options");
    expect(readme).toContain("explicitly rejected");
    expect(readme).toContain("pnpm benchmark:history");
    expect(readmeZh).toContain("pnpm benchmark:history");
    expect(readme).toContain("browser extension QA checklist");
    expect(readmeZh).toContain("browser extension QA checklist");
    expect(readme).toContain("pnpm test:e2e:devtools-extension");
    expect(readmeZh).toContain("pnpm test:e2e:devtools-extension");
    expect(packageUsage).toContain("pnpm test:e2e:devtools-extension");
    expect(projectStatus).toContain("pnpm test:e2e:devtools-extension");
    expect(projectStatusZh).toContain("pnpm test:e2e:devtools-extension");
    expect(packageUsage).toContain("example-grade broad inspected-page access");
    expect(packageUsage).toContain("review and narrow extension permissions");
    expect(projectStatus).toContain("route `meta` is not mistaken for enforcement");
    expect(projectStatus).toContain("review and narrow extension permissions");
    expect(projectStatusZh).toContain("收窄 extension permissions");
    expect(api).toContain("Hydration options must be a non-array object");
    expect(packageUsage).toContain("Hydration options must be a non-array object");
    expect(api).toContain("`renderToString()` context, when provided, must be a plain object");
    expect(api).toContain("unknown own option fields throw a `TypeError` naming the field");
    expect(apiZh).toContain("未知的自有 option 字段会抛出包含字段名的 `TypeError`");
    expect(api).toContain("`router`, or `stream` to `renderToString()`");
    expect(packageUsage).toContain(
      "`renderToString()` context, when provided, must be a plain object",
    );
    expect(packageUsage).toContain("`router`, or `stream` to `renderToString()`");
    expect(api).toContain("including direct sources, SSG route sources, and async child values");
    expect(apiZh).toContain("包括 direct sources、SSG route sources 和 async child values");
    expect(api).toContain("are rejected by the synchronous `renderToString()`");
    expect(apiZh).toContain("同步 `renderToString()`、`generateStaticSite()`、`hydrate()`");
    expect(api).toMatch(/deferred `manifest`, `clientEntry`,\s+`router`, or `stream` fields/);
    expect(api).toContain("`stream` fields to `hydrate()`");
    expect(apiZh).toContain("`manifest`、`clientEntry`、`router` 或 `stream`");
    expect(packageUsage).toContain("manifest/router/streaming integration fields");
    expect(packageUsage).toMatch(/Unknown own option or route\s+fields throw a `TypeError`/);
    expect(readme).toContain("reject unknown own fields with a field-specific");
    expect(readmeZh).toContain("拒绝未知自有字段");
    expect(projectStatus).toContain("reject unknown own fields with field-specific `TypeError`");
    expect(projectStatusZh).toContain("拒绝未知自有字段");
    expect(packageUsage).toContain("The buffered async server entries");
    expect(packageUsage).toMatch(
      /accept promised roots, async components, and VNodes with\s+promised children/,
    );
    expect(packageUsage).toMatch(
      /`hydrateAsync\(\)` supports async\s+components and VNodes with\s+promised children/,
    );
    expect(packageUsage).toMatch(/not a\s+promised root/);
    expect(packageUsage).toContain("@italone/solace/package.json");
    expect(packageUsage).toContain("`pnpm stable:app` as a mandatory gate");
    expect(packageUsage).toContain("Existing synchronous APIs retain synchronous return types");
    expect(projectStatus).toContain("prepares before touching server DOM");
    expect(projectStatus).toContain("reject unresolved async values");
    expect(projectStatusZh).toContain("拒绝未解析 async values");
    expect(projectStatus).toContain("buffered HTML/styles");
    expect(projectStatusZh).toContain("buffered HTML/styles");
    expect(projectStatus).toContain("Public contract gates remain the first release line");
    expect(projectStatusZh).toContain("公开契约门禁仍是发布前的第一条防线");
    expect(projectStatus).toContain("browser extension QA checklist");
    expect(projectStatusZh).toContain("browser extension QA checklist");
    expect(projectStatus).toContain("2026-08-11 full local `pnpm release:check` passed");
    expect(projectStatus).toContain("71 Vitest files / 625 tests");
    expect(projectStatus).toContain("94.28% statements");
    expect(projectStatus).toContain("89.18% branches");
    expect(projectStatus).toMatch(/96\.28%\s+functions/);
    expect(projectStatus).toContain("94.32% lines");
    expect(projectStatus).toMatch(/24 browser e2e\s+tests across Chromium, Firefox, and WebKit/);
    expect(projectStatus).toMatch(/2\s+Chromium-only\s+DevTools\s+extension\s+e2e\s+tests/);
    expect(projectStatusZh).toContain("2026-08-11 的完整本地 `pnpm release:check` 已通过");
    expect(projectStatusZh).toMatch(/71 个 Vitest\s+文件 \/ 625 个测试/);
    expect(projectStatusZh).toContain("94.28% statements");
    expect(projectStatusZh).toContain("89.18% branches");
    expect(projectStatusZh).toMatch(/96\.28%\s+functions/);
    expect(projectStatusZh).toContain("94.32% lines");
    expect(projectStatusZh).toMatch(/Chromium、Firefox、WebKit 共 24 个\s+browser e2e 测试/);
    expect(projectStatusZh).toMatch(/2\s+个仅\s+Chromium\s+的\s+DevTools\s+extension\s+e2e\s+测试/);

    for (const doc of [readme, api, packageUsage, projectStatus]) {
      expect(doc).toContain("renderToStringAsync()");
      expect(doc).toContain("generateStaticSiteAsync()");
      expect(doc).toContain("hydrateAsync()");
    }
    for (const doc of [readmeZh, apiZh, projectStatusZh]) {
      expect(doc).toContain("renderToStringAsync()");
      expect(doc).toContain("generateStaticSiteAsync()");
      expect(doc).toContain("hydrateAsync()");
    }
    expect(api).toContain("setup-once");
    expect(apiZh).toContain("setup-once");
    expect(api).toContain("after `await`");
    expect(apiZh).toContain("`await` 之后");
    expect(api).toContain("synchronous render function");
    expect(apiZh).toContain("同步 render function");
    expect(api).toContain("async update scheduling remains deferred");
    expect(apiZh).toContain("async update scheduling 仍保持 deferred");
    expect(api).toContain("[Compatibility and deprecation policy](./compatibility.md)");
    expect(apiZh).toContain("[兼容性与弃用策略](./compatibility.zh-CN.md)");

    expect(api).toContain("scroll behavior");
    expect(packageUsage).toContain("scrollBehavior");
    expect(projectStatus).toContain("scroll behavior");

    for (const doc of [readme, api, packageUsage, projectStatus]) {
      expect(doc).toContain("auth");
      expect(doc).toContain("permissions");
      expect(doc).toContain("router-aware SSR");
      expect(doc).toContain("router-aware hydration");
      expect(doc).toContain("streaming SSR");
    }
    expect(packageUsage).toContain("[Compatibility and deprecation policy](./compatibility.md)");
    expect(packageUsage).toContain("[兼容性与弃用策略](./compatibility.zh-CN.md)");
    expect(compatibility).toContain("0.1.x");
    expect(compatibilityZh).toContain("0.1.x");
  });
});
