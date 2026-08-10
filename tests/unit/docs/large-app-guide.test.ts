import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

async function readDoc(path: string): Promise<string> {
  return readFile(path, "utf8");
}

describe("large app guide", () => {
  it("documents the current large-app patterns in English and Chinese", async () => {
    const [en, zh] = await Promise.all([
      readDoc("docs/large-app.md"),
      readDoc("docs/large-app.zh-CN.md"),
    ]);

    expect(en).toContain("# Large App Guide");
    expect(zh).toContain("# 大型应用指南");
    expect(en).toContain("feature modules owned by routes");
    expect(zh).toContain("由路由拥有的 feature 模块");
    expect(en).toContain("## First Slice");
    expect(zh).toContain("## 第一个切片");
    expect(en).toContain("put the route record next to the feature page");
    expect(zh).toContain("把 route record 放在 feature page 旁边");
    expect(en).toContain("## Route Slice Example");
    expect(zh).toContain("## Route Slice 示例");
    expect(en).toContain('import type { RouteRecord } from "@italone/solace"');
    expect(zh).toContain('import type { RouteRecord } from "@italone/solace"');
    expect(en).toContain("createWebHistory");
    expect(zh).toContain("createWebHistory");
    expect(en).toContain("Do not add `auth` or `permissions` fields");
    expect(zh).toContain("不要在 router");
    expect(en).toContain("## Adoption Checklist");
    expect(zh).toContain("## 采用检查清单");
    expect(en).toContain("documented package-root APIs");
    expect(zh).toContain("文档化 package-root APIs");
    expect(en).toContain("package smoke and browser e2e checks");
    expect(zh).toContain("package smoke 和 browser e2e checks");
    expect(en).toContain("## Ecosystem And UI Libraries");
    expect(zh).toContain("## 生态和 UI 库");
    expect(en).toContain("does not currently ship a first-party UI component library");
    expect(zh).toContain("没有一方 UI component library");
    expect(en).toContain(
      "avoid package-level adapters until a real app proves the integration shape",
    );
    expect(zh).toContain("不急着做 package-level adapters");
    expect(en).toContain("## State Ownership Cheat Sheet");
    expect(zh).toContain("## 状态归属速查表");
    expect(en).toContain("local reactive state: form drafts, modal toggles");
    expect(zh).toContain("local reactive state：表单草稿");
    expect(en).toContain("pnpm release:readiness");
    expect(zh).toContain("pnpm release:readiness");
    expect(en).toContain("pnpm test:e2e:devtools-extension");
    expect(zh).toContain("pnpm test:e2e:devtools-extension");
    expect(en).toContain("pnpm benchmark:history");
    expect(zh).toContain("pnpm benchmark:history");
    expect(en).toContain("Keep `.benchmark-history/` as ignored local JSONL history");
    expect(zh).toContain("`.benchmark-history/` 只作为本地忽略 JSONL history");
  });
});
