import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

async function readDoc(path: string): Promise<string> {
  return readFile(path, "utf8");
}

describe("public contract documentation", () => {
  it("keeps release gates and deferred beta boundaries aligned", async () => {
    const [readme, readmeZh, api, apiZh, packageUsage, projectStatus, projectStatusZh] =
      await Promise.all([
        readDoc("readme.md"),
        readDoc("readme.zh-CN.md"),
        readDoc("docs/api.md"),
        readDoc("docs/api.zh-CN.md"),
        readDoc("docs/package-usage.md"),
        readDoc("docs/project-status.md"),
        readDoc("docs/project-status.zh-CN.md"),
      ]);

    expect(readme).toContain("## Public Contract Gate");
    expect(readmeZh).toContain("## 公开契约门禁");
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
    expect(api).toContain("`router`, or `stream` to `renderToString()`");
    expect(packageUsage).toContain(
      "`renderToString()` context, when provided, must be a plain object",
    );
    expect(packageUsage).toContain("`router`, or `stream` to `renderToString()`");
    expect(api).toContain("including direct sources, SSG route sources, and async child values");
    expect(apiZh).toContain("包括 direct sources、SSG route sources 和 async child values");
    expect(api).toContain("Hydration also rejects async or thenable direct sources");
    expect(apiZh).toContain("Hydration 也会拒绝 async 或 thenable direct sources");
    expect(api).toContain("deferred `manifest`, `clientEntry`, `router`, or");
    expect(api).toContain("`stream` fields to `hydrate()`");
    expect(apiZh).toContain("`manifest`、`clientEntry`、`router` 或 `stream`");
    expect(packageUsage).toContain("manifest/router/streaming integration fields");
    expect(packageUsage).toMatch(
      /including direct\s+sources, SSG route sources, and async child values/,
    );
    expect(packageUsage).toMatch(/Hydration also rejects async or thenable direct\s+sources/);
    expect(projectStatus).toContain("validates hydration options");
    expect(projectStatus).toContain("async/thenable hydration direct sources");
    expect(projectStatusZh).toContain("async/thenable hydration direct sources");
    expect(projectStatus).toContain("async/thenable SSR direct sources, SSG route sources");
    expect(projectStatusZh).toContain("async/thenable SSR direct sources、SSG route sources");
    expect(projectStatus).toContain("Public contract gates remain the first release line");
    expect(projectStatusZh).toContain("公开契约门禁仍是发布前的第一条防线");
    expect(projectStatus).toContain("browser extension QA checklist");
    expect(projectStatusZh).toContain("browser extension QA checklist");
    expect(projectStatus).toContain("2026-08-11 full local `pnpm release:check` passed");
    expect(projectStatus).toContain("67 Vitest files / 556 tests");
    expect(projectStatus).toContain("95.29% statements");
    expect(projectStatus).toContain("90.54% branches");
    expect(projectStatus).toContain("95.3% lines");
    expect(projectStatus).toContain("DevTools extension e2e 2 tests");
    expect(projectStatusZh).toContain("2026-08-11 的完整本地 `pnpm release:check` 已通过");
    expect(projectStatusZh).toContain("67 个 Vitest 文件 / 556 个测试");
    expect(projectStatusZh).toContain("95.29% statements");
    expect(projectStatusZh).toContain("90.54% branches");
    expect(projectStatusZh).toContain("95.3% lines");
    expect(projectStatusZh).toContain("DevTools extension e2e 2 个测试");

    expect(api).toContain("scroll behavior");
    expect(packageUsage).toContain("scrollBehavior");
    expect(projectStatus).toContain("scroll behavior");

    for (const doc of [readme, api, packageUsage, projectStatus]) {
      expect(doc).toContain("auth");
      expect(doc).toContain("permissions");
      expect(doc).toContain("router-aware SSR");
      expect(doc).toContain("router-aware hydration");
      expect(doc).toContain("streaming SSR");
      expect(doc).toContain("async component SSR");
      expect(doc).toContain("async hydration");
    }
  });
});
