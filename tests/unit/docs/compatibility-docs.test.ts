import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const expectedExports = [
  ".",
  "./devtools",
  "./jsx-dev-runtime",
  "./jsx-runtime",
  "./package.json",
  "./server",
  "./sfc",
  "./vite",
];

const protectedEntries = [
  "@italone/solace",
  "@italone/solace/devtools",
  "@italone/solace/jsx-dev-runtime",
  "@italone/solace/jsx-runtime",
  "@italone/solace/package.json",
  "@italone/solace/server",
  "@italone/solace/sfc",
  "@italone/solace/vite",
];

const englishSections = [
  "## Compatibility Contract",
  "## Protected Package Entries",
  "## Frozen Public Maturity Boundary",
  "## Maturity And Deferred Features",
  "## Private Implementation Details",
  "## Deprecation Process",
  "## Exceptions",
];

const chineseSections = [
  "## 兼容性契约",
  "## 受保护的包入口",
  "## 冻结的公共成熟度边界",
  "## 成熟度与延期能力",
  "## 私有实现细节",
  "## 弃用流程",
  "## 例外情况",
];

const sectionPositions = (document: string, sections: string[]) =>
  sections.map((section) => document.indexOf(section));

describe("compatibility and deprecation policy documentation", () => {
  it("protects the published entry points and aligns the bilingual policy structure", async () => {
    const [english, chinese, packageSource] = await Promise.all([
      readFile("docs/compatibility.md", "utf8").catch(() => ""),
      readFile("docs/compatibility.zh-CN.md", "utf8").catch(() => ""),
      readFile("package.json", "utf8"),
    ]);
    const packageJson = JSON.parse(packageSource) as { exports: Record<string, unknown> };

    expect(Object.keys(packageJson.exports).sort()).toEqual(expectedExports);
    expect(englishSections.map((section) => english.includes(section))).toEqual(
      englishSections.map(() => true),
    );
    expect(chineseSections.map((section) => chinese.includes(section))).toEqual(
      chineseSections.map(() => true),
    );
    expect(englishSections).toHaveLength(chineseSections.length);
    expect(sectionPositions(english, englishSections)).toEqual(
      [...sectionPositions(english, englishSections)].sort((left, right) => left - right),
    );
    expect(sectionPositions(chinese, chineseSections)).toEqual(
      [...sectionPositions(chinese, chineseSections)].sort((left, right) => left - right),
    );

    for (const entry of protectedEntries) {
      expect(english).toContain(entry);
      expect(chinese).toContain(entry);
    }

    for (const policy of [english, chinese]) {
      expect(policy).toContain("0.1.x");
      expect(policy).toContain("0.2.0");
      expect(policy).toContain("src/**");
      expect(policy).toContain("dist/**");
      expect(policy).toContain("deprecation marker");
      expect(policy).toContain("replacement");
      expect(policy).toContain("`@deprecated` marker/declaration");
      expect(policy).toMatch(/TypeScript (?:type|类型)/);
      expect(policy).toContain("migration example");
      expect(policy).toContain("changeset");
      expect(policy).toContain("release note");
      expect(policy).toContain("retained tests");
      expect(policy).toContain("security/correctness");
    }

    expect(english).toContain("at least one published `0.1.x` release");
    expect(chinese).toContain("至少一个已发布的 `0.1.x` 版本");
    expect(english).toContain("patch releases are additive or fix-only");
    expect(chinese).toContain("patch release 只能新增或修复");
    expect(english).toContain("no earlier than `0.2.0`");
    expect(chinese).toContain("不得早于 `0.2.0`");
    expect(english).toContain("without silent entry removal");
    expect(chinese).toContain("不得静默移除入口");
    expect(english).toMatch(/\| `\.`\s+\| `@italone\/solace`\s+\| Beta\s+\|/);
    expect(chinese).toMatch(/\| `\.`\s+\| `@italone\/solace`\s+\| Beta\s+\|/);
    expect(english).toContain(
      "`./jsx-runtime`, `./jsx-dev-runtime`, and `./package.json` as stable",
    );
    expect(english).toMatch(
      /The root entry, `\.\/server`, and `\.\/devtools` remain beta; `\.\/sfc` and\s+`\.\/vite` remain experimental/,
    );
    expect(english).toContain("`stableAdmission` remains `false`");
    expect(english).toContain("A maturity promotion requires a separate design");
    expect(chinese).toContain(
      "`./jsx-runtime`、`./jsx-dev-runtime` 和 `./package.json` 冻结为 stable",
    );
    expect(chinese).toMatch(
      /根入口、`\.\/server` 和 `\.\/devtools` 继续为 beta；`\.\/sfc` 和 `\.\/vite` 继续为\s+experimental/,
    );
    expect(chinese).toContain("`stableAdmission` 保持为 `false`");
    expect(chinese).toContain("成熟度晋级需要单独设计");
    for (const policy of [english, chinese]) {
      expect(policy).toContain("release/public-contract.json");
      expect(policy).toContain("pnpm release:contract:check");
    }
  });
});
