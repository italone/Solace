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
      routerAwareSsrDesign,
      migration,
      migrationZh,
      release,
      roadmap,
      changelog,
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
      readDoc("docs/superpowers/specs/2026-08-14-router-aware-ssr-hydration-design.md"),
      readDoc("docs/migration.md"),
      readDoc("docs/migration.zh-CN.md"),
      readDoc("docs/release.md"),
      readDoc("docs/roadmap.md"),
      readDoc("CHANGELOG.md"),
    ]);

    expect(readme).toContain("## Public Contract Gate");
    expect(readmeZh).toContain("## 公开契约门禁");
    expect(readme).toContain("[Compatibility and deprecation policy](./docs/compatibility.md)");
    expect(readmeZh).toContain("[兼容性与弃用策略](./docs/compatibility.zh-CN.md)");
    expect(api).toContain("## Deferred Beta Boundaries");
    expect(apiZh).toContain("## Deferred Beta 边界");
    for (const doc of [api, apiZh, packageUsage]) {
      expect(doc).toContain("router.isReady()");
      expect(doc).toContain("createRouterServerContext()");
      expect(doc).toContain("createRouterSnapshot");
      expect(doc).toContain("parseRouterSnapshot");
      expect(doc).toContain("serializeRouterSnapshot");
      expect(doc).toContain("verifyRouterSnapshot");
      expect(doc).toContain("RouterHydrationError");
    }
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
    expect(projectStatus).toContain("`release/performance-history.json`");
    expect(projectStatusZh).toContain("`release/performance-history.json`");
    expect(projectStatus).toMatch(/five distinct\s+dates for every browser scenario/);
    expect(projectStatusZh).toContain("五个不同日期的历史");
    expect(projectStatus).toContain("`release/adoption-evidence.md`");
    expect(projectStatusZh).toContain("`release/adoption-evidence.md`");
    expect(release).toContain("pnpm benchmark:history:evidence");
    expect(release).toContain("five distinct `runAt` timestamps");
    expect(release).toContain("pnpm performance:regression");
    expect(changelog).toContain("`router.isReady()`");
    expect(changelog).toContain("`createRouterServerContext()`");
    expect(packageUsage).toContain("restricted to the fixed local demo origins");
    expect(packageUsage).toContain("review the exact inspected origins");
    expect(projectStatus).toContain("route `meta` is not mistaken for enforcement");
    expect(projectStatus).toContain("now restricted to the local 6174 demo origins");
    expect(projectStatusZh).toContain("现在只允许本地 6174 demo origins");
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
    expect(projectStatus).toContain("final 2026-08-14 beta.5 local `pnpm release:check` passed");
    expect(projectStatus).toContain("81 Vitest files / 702 tests");
    expect(projectStatus).toContain("92.97% statements");
    expect(projectStatus).toContain("88.11% branches");
    expect(projectStatus).toMatch(/95\.21%\s+functions/);
    expect(projectStatus).toContain("93.25% lines");
    expect(projectStatus).toContain("71 Vitest files / 626 tests");
    expect(projectStatus).toContain("94.28% statements");
    expect(projectStatus).toContain("89.18% branches");
    expect(projectStatus).toMatch(/96\.28%\s+functions/);
    expect(projectStatus).toContain("94.32% lines");
    expect(projectStatus).toMatch(/24 browser e2e\s+tests across Chromium, Firefox, and WebKit/);
    expect(projectStatus).toMatch(/2\s+Chromium-only\s+DevTools\s+extension\s+e2e\s+tests/);
    expect(projectStatusZh).toContain("2026-08-14 beta.5 契约、adoption 和 performance evidence");
    expect(projectStatusZh).toMatch(/81 个 Vitest\s+文件 \/ 702 个测试/);
    expect(projectStatusZh).toMatch(/92\.97%\s+statements/);
    expect(projectStatusZh).toContain("88.11% branches");
    expect(projectStatusZh).toMatch(/95\.21%\s+functions/);
    expect(projectStatusZh).toContain("93.25% lines");
    expect(projectStatusZh).toMatch(/Chromium、Firefox、WebKit 共 24 个\s+browser e2e 测试/);
    expect(projectStatusZh).toMatch(/2\s+个仅\s+Chromium\s+的\s+DevTools\s+extension\s+e2e\s+测试/);
    expect(readme).toContain("local, unpublished\n`0.1.0-beta.6` candidate");
    expect(readme).toContain("npm `beta` is\n`0.1.0-beta.5`");
    expect(readmeZh).toContain("本地、尚未发布的 `0.1.0-beta.6` candidate");
    expect(readmeZh).toContain("npm `beta` 是 `0.1.0-beta.5`");
    expect(projectStatus).toContain("Repository package version: local `0.1.0-beta.6` candidate");
    expect(projectStatus).toContain("Published npm `beta`: `0.1.0-beta.5`");
    expect(projectStatus).toContain("local `v0.1.0-beta.5` tag points to release commit `afe459e`");
    expect(projectStatus).toContain("Remote `v0.1.0-beta.5` tag verification remains pending");
    expect(projectStatusZh).toContain("仓库 package 版本：本地 `0.1.0-beta.6` candidate");
    expect(projectStatusZh).toContain("npm `beta` 已发布版本：`0.1.0-beta.5`");
    expect(projectStatusZh).toContain("本地 `v0.1.0-beta.5` tag 指向发布提交 `afe459e`");
    expect(projectStatusZh).toContain("远端 `v0.1.0-beta.5` tag 仍待复核");

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

    for (const doc of [api, packageUsage]) {
      expect(doc).toContain("ComponentEventMap");
      expect(doc).toContain("defineComponent<Props, Events>");
      expect(doc).toContain("permissive by default");
      expect(doc).toContain("at compile time");
      expect(doc).toContain("does not add runtime validation");
      expect(doc).toContain("explicit event maps infer precise `onXxx` listener payloads");
      expect(doc).toContain("canonical camelized listener");
      expect(doc).toContain("function or an array of functions");
    }

    expect(apiZh).toContain("ComponentEventMap");
    expect(apiZh).toContain("defineComponent<Props, Events>");
    expect(apiZh).toContain("默认保持宽松");
    expect(apiZh).toContain("编译期");
    expect(apiZh).toMatch(/不增加运行时\s+校验/);
    expect(apiZh).toContain("显式事件映射会推导精确的 `onXxx` listener payload");
    expect(apiZh).toContain("规范的 camelized listener");
    expect(apiZh).toContain("函数或函数数组");

    for (const doc of [api, apiZh]) {
      expect(doc).toContain("ComponentType<");
      expect(doc).toContain("ComponentSetupContext<Events, SlotMap>");
    }

    expect(packageUsage).toContain("[Compatibility and deprecation policy](./compatibility.md)");
    expect(packageUsage).toContain("[兼容性与弃用策略](./compatibility.zh-CN.md)");
    expect(compatibility).toContain("0.1.x");
    expect(compatibilityZh).toContain("0.1.x");

    expect(migration).toContain("## Migration Procedure");
    expect(migration).toContain("## Exact Package Consumer Validation");
    expect(migration).toContain("## Rollback Triggers");
    expect(migration).toContain("## Rollback Procedure");
    expect(migration).toContain("Published npm versions are immutable");
    expect(migration).toMatch(/separate\s+maintainer authorization/);
    expect(migration).toContain("adoption.independent-apps");
    expect(migrationZh).toContain("## 迁移流程");
    expect(migrationZh).toContain("## 精确包消费者验证");
    expect(migrationZh).toContain("## 回滚触发条件");
    expect(migrationZh).toContain("## 回滚流程");
    expect(migrationZh).toContain("已发布的 npm 版本不可变");
    expect(migrationZh).toContain("单独的维护者授权");
    expect(migrationZh).toContain("adoption.independent-apps");
    expect(release).toContain("[migration and rollback runbook](./migration.md)");
    expect(release).toContain("[迁移与回滚手册](./migration.zh-CN.md)");
    expect(roadmap).toContain("the stricter evidence checklist currently reports `INCOMPLETE`");
    expect(projectStatus).toContain("Solace 1.0 evidence checklist");
    expect(projectStatus).toContain("reports `INCOMPLETE`");
    expect(projectStatus).toContain("not Solace-primary production adoption");
    expect(projectStatusZh).toContain("Solace 1.0 evidence checklist");
    expect(projectStatusZh).toMatch(/当前报告[\s\S]*`INCOMPLETE`/);

    expect(routerAwareSsrDesign).toContain("createMemoryHistory()");
    expect(routerAwareSsrDesign).toContain("canonical route snapshot");
    expect(routerAwareSsrDesign).toContain("server context");
    expect(routerAwareSsrDesign).toContain("hydration verification");
    expect(routerAwareSsrDesign).toContain("Implemented locally and verified on 2026-08-14");
    expect(projectStatus).toContain("Direct renderer-owned SSR/hydration integration");
    expect(projectStatusZh).toContain("renderer-owned 直接 SSR/hydration 集成");
    for (const deferredBoundary of [
      "auth",
      "permissions",
      "streaming",
      "Suspense",
      "route crawling",
      "filesystem output",
    ]) {
      expect(routerAwareSsrDesign).toContain(deferredBoundary);
    }
    expect(routerAwareSsrDesign).toContain("Router-aware SSR integration is deferred");
    expect(routerAwareSsrDesign).toContain("Router-aware SSG integration is deferred");
    expect(routerAwareSsrDesign).toContain("Router-aware hydration integration is deferred");
  });
});
