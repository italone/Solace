# Release Publish Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local release readiness check and documentation that make Solace's publish decision explicit without publishing or removing `"private": true`.

**Architecture:** Implement a small ESM Node script under `scripts/` that reads `package.json` and `.changeset/config.json`, validates local release metadata, and distinguishes default private-readiness mode from explicit `--publishable` mode. Wire it through `package.json`, document the release decision gate, and record the change in the project log.

**Tech Stack:** Node.js ESM, `node:fs/promises`, `node:path`, `node:url`, pnpm package scripts, Changesets config, Markdown docs, Prettier, ESLint.

---

## File Structure

- Create `scripts/release-readiness-check.mjs`: local read-only release metadata preflight.
- Modify `package.json`: add `release:readiness` script.
- Modify `docs/release.md`: document readiness modes and publish decision checklist.
- Modify `docs/package-usage.md`: point users to readiness check before registry install assumptions.
- Modify `readme.md`: update publish-related future recommendation.
- Add `solace-project-log/solace-entries/2026-07-14-001-release-publish-readiness.md`: project log entry.
- Modify `solace-project-log/index.md`: add the 2026-07-14 entry.

No package publishability flag, package version, package exports, or runtime source should change.

---

### Task 1: Add Release Readiness Script

**Files:**

- Create: `scripts/release-readiness-check.mjs`

- [ ] **Step 1: Create the script**

Create `scripts/release-readiness-check.mjs` with:

```js
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publishableMode = process.argv.includes("--publishable");

const packageJson = await readJson("package.json");
const changesetConfig = await readJson(".changeset/config.json");
const failures = [];
const warnings = [];

requireString(packageJson.name, "package.json name");
requireString(packageJson.version, "package.json version");
requireString(packageJson.main, "package.json main");
requireString(packageJson.module, "package.json module");
requireString(packageJson.types, "package.json types");
requireArray(packageJson.files, "package.json files");
requireObject(packageJson.exports, "package.json exports");
requireObject(packageJson.scripts, "package.json scripts");

requireScript("quality");
requireScript("package:smoke");
requireScript("release:check");
requireScript("release:version");
requireScript("release:publish");

if (changesetConfig.access !== "public") {
  failures.push('.changeset/config.json access must be "public" before public publishing.');
}

if (packageJson.private === true) {
  if (publishableMode) {
    failures.push(
      'package.json still has "private": true; remove it only after explicit publish approval.',
    );
  } else {
    warnings.push(
      'package.json has "private": true; package is intentionally not publishable yet.',
    );
  }
} else if (packageJson.private !== undefined && packageJson.private !== false) {
  failures.push("package.json private must be true, false, or omitted.");
}

if (!packageJson.files.includes("dist")) {
  failures.push('package.json files must include "dist".');
}

if (!packageJson.files.includes("readme.md")) {
  failures.push('package.json files must include "readme.md".');
}

if (!packageJson.files.includes("docs/*.md")) {
  failures.push('package.json files must include "docs/*.md".');
}

if (failures.length > 0) {
  console.error("release readiness check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log("release readiness check passed");
  console.log(`package: ${packageJson.name}@${packageJson.version}`);
  console.log(`changeset access: ${changesetConfig.access}`);
  console.log(`mode: ${publishableMode ? "publishable" : "default"}`);
}

for (const warning of warnings) {
  console.log(`note: ${warning}`);
}

if (!publishableMode) {
  console.log("publishability: skipped; run with --publishable after explicit publish approval.");
}

async function readJson(relativePath) {
  const raw = await readFile(resolve(root, relativePath), "utf8");
  return JSON.parse(raw);
}

function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    failures.push(`${label} must be a non-empty string.`);
  }
}

function requireArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    failures.push(`${label} must be a non-empty array.`);
  }
}

function requireObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    failures.push(`${label} must be an object.`);
  }
}

function requireScript(name) {
  if (packageJson.scripts === null || typeof packageJson.scripts !== "object") {
    failures.push(`package.json scripts must include "${name}".`);
    return;
  }

  if (typeof packageJson.scripts[name] !== "string" || packageJson.scripts[name].length === 0) {
    failures.push(`package.json scripts must include "${name}".`);
  }
}
```

- [ ] **Step 2: Run script directly in default mode**

Run:

```bash
node scripts/release-readiness-check.mjs
```

Expected:

- Exits with code 0.
- Output includes `release readiness check passed`.
- Output includes `note: package.json has "private": true`.

- [ ] **Step 3: Run script directly in publishable mode**

Run:

```bash
node scripts/release-readiness-check.mjs --publishable
```

Expected:

- Exits with non-zero code.
- Output includes `release readiness check failed`.
- Output includes `package.json still has "private": true`.

---

### Task 2: Add Package Script

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Add release readiness script**

In `package.json`, add this script near the other release scripts:

```json
"release:readiness": "node scripts/release-readiness-check.mjs",
```

The release script group should include:

```json
"changeset": "changeset",
"release:readiness": "node scripts/release-readiness-check.mjs",
"release:version": "changeset version",
"release:check": "pnpm quality && pnpm test:coverage && pnpm package:smoke && pnpm benchmark && pnpm test:e2e",
"release:publish": "pnpm release:check && changeset publish",
```

- [ ] **Step 2: Run package script in default mode**

Run:

```bash
pnpm release:readiness
```

Expected:

- Exits with code 0.
- Output includes `release readiness check passed`.
- Output includes `publishability: skipped`.

- [ ] **Step 3: Run package script in publishable mode**

Run:

```bash
pnpm release:readiness -- --publishable
```

Expected:

- Exits with non-zero code because `package.json` still has `"private": true`.
- Output includes `release readiness check failed`.
- Output includes `package.json still has "private": true`.

---

### Task 3: Update Release Documentation

**Files:**

- Modify: `docs/release.md`
- Modify: `docs/package-usage.md`
- Modify: `readme.md`

- [ ] **Step 1: Add release readiness section to release docs**

In `docs/release.md`, add this section after "Local Release Gate":

````md
## Release Readiness

Run the local metadata readiness check before changing publishability:

```bash
pnpm release:readiness
```
````

This command checks local package metadata, package entry points, release scripts, and Changesets
public access configuration. It does not contact npm and does not publish.

The package intentionally remains private by default. To verify the stricter publishable mode after a
maintainer explicitly approves publishing and removes or changes `"private": true`, run:

```bash
pnpm release:readiness -- --publishable
```

While `"private": true` remains set, publishable mode is expected to fail.

````

- [ ] **Step 2: Replace publish paragraph with checklist**

In `docs/release.md`, replace the first paragraph under `## Publish` with:

```md
The package currently keeps `"private": true` in `package.json`, so it is not publishable by default.
Before removing or changing that field, explicitly confirm:

- the npm package name `solace` is available or controlled by the maintainer,
- npm authentication and organization access are configured,
- public access is intended,
- `pnpm release:readiness` passes,
- `pnpm release:check` passes,
- `pnpm package:smoke` passes after the final version update,
- Changesets versioning has been run for user-visible changes.
````

Keep the existing `pnpm release:publish` command block after the checklist.

- [ ] **Step 3: Update package usage install note**

In `docs/package-usage.md`, replace:

```md
Before that release decision, validate package consumption with the packed-consumer smoke test described below.
```

with:

```md
Before that release decision, run `pnpm release:readiness` to check local release metadata and validate package consumption with the packed-consumer smoke test described below.
```

- [ ] **Step 4: Update README future recommendation**

In `readme.md`, under `## 14. 后续建议`, replace:

```md
- 发布前明确包的公开策略，移除或调整 `private` 配置，并完成 Changesets version 流程。
```

with:

```md
- 发布前运行 release readiness 检查，确认 npm 包名、访问权限、Changesets version 和 `private` 配置调整策略。
```

---

### Task 4: Add Project Log

**Files:**

- Add: `solace-project-log/solace-entries/2026-07-14-001-release-publish-readiness.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Add project log entry**

Create `solace-project-log/solace-entries/2026-07-14-001-release-publish-readiness.md` with:

```md
# 2026-07-14-001：新增发布准备检查

## 基本信息

- 日期：2026-07-14
- 类型：工具 / 文档
- 状态：验证中
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

新增本地 release readiness 检查，用于验证 package metadata、package entry points、release scripts 和 Changesets public access 配置。默认模式保留当前 `"private": true` 策略并提示包尚不可发布；`--publishable` 模式会在当前 private 状态下失败，避免误发布。

## 变动原因

Solace 已有 Changesets 和 release gate，但发布策略仍停留在文档说明。新增只读 readiness 检查可以在不联系 npm、不发布、不移除 `private` 的前提下，把发布前决策和本地元数据检查固定下来。

## 影响范围

- 影响模块：release tooling、package scripts、release/package 文档、README、项目日志。
- 行为变化：新增 `pnpm release:readiness`，不改变 `release:publish` 行为。
- 风险等级：低；新增只读脚本和文档，不修改 runtime 或发布私有状态。

## 涉及文件

| 文件                                                                            | 动作 | 说明                                    |
| ------------------------------------------------------------------------------- | ---- | --------------------------------------- |
| `scripts/release-readiness-check.mjs`                                           | 新增 | 本地发布准备检查脚本                    |
| `package.json`                                                                  | 修改 | 新增 `release:readiness` script         |
| `docs/release.md`                                                               | 修改 | 记录 readiness 命令和 publish checklist |
| `docs/package-usage.md`                                                         | 修改 | 增加 release readiness 指引             |
| `readme.md`                                                                     | 修改 | 更新后续发布建议                        |
| `docs/superpowers/specs/2026-07-14-release-publish-readiness-design.md`         | 新增 | 记录设计                                |
| `docs/superpowers/plans/2026-07-14-release-publish-readiness.md`                | 新增 | 记录实施计划                            |
| `solace-project-log/index.md`                                                   | 修改 | 追加本次日志索引                        |
| `solace-project-log/solace-entries/2026-07-14-001-release-publish-readiness.md` | 新增 | 记录本次变更                            |

## 验证记录

| 验证项                | 命令或方式                                | 结果   |
| --------------------- | ----------------------------------------- | ------ |
| Readiness default     | `pnpm release:readiness`                  | 待执行 |
| Readiness publishable | `pnpm release:readiness -- --publishable` | 待执行 |
| Typecheck             | `pnpm typecheck`                          | 待执行 |
| Lint                  | `pnpm lint`                               | 待执行 |
| 格式检查              | `pnpm format:check`                       | 待执行 |

## 后续动作

- 真正发布前仍需人工确认 npm 包名、访问权限、Changesets version 和是否移除或调整 `"private": true`。
```

- [ ] **Step 2: Add project log index section**

In `solace-project-log/index.md`, add a new section before `## 维护说明`:

```md
## 2026-07-14

| 编号 | 变动             | 影响范围                                       | 涉及文件                                                                                                                                | 日志                                                                 |
| ---- | ---------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 001  | 新增发布准备检查 | release tooling、package scripts、release 文档 | `scripts/release-readiness-check.mjs`, `package.json`, `docs/release.md`, `docs/package-usage.md`, `readme.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-14-001-release-publish-readiness.md) |
```

---

### Task 5: Format And Validate

**Files:**

- Modify after validation: `solace-project-log/solace-entries/2026-07-14-001-release-publish-readiness.md`
- Modify if formatting changes are needed: all files touched in Tasks 1-4

- [ ] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write scripts/release-readiness-check.mjs package.json docs/release.md docs/package-usage.md readme.md docs/superpowers/specs/2026-07-14-release-publish-readiness-design.md docs/superpowers/plans/2026-07-14-release-publish-readiness.md solace-project-log/solace-entries/2026-07-14-001-release-publish-readiness.md solace-project-log/index.md
```

Expected: Prettier exits with code 0.

- [ ] **Step 2: Run default readiness check**

Run:

```bash
pnpm release:readiness
```

Expected:

- Exits with code 0.
- Output includes `release readiness check passed`.
- Output includes `package.json has "private": true`.

- [ ] **Step 3: Run publishable readiness check**

Run:

```bash
pnpm release:readiness -- --publishable
```

Expected:

- Exits with non-zero code.
- Output includes `release readiness check failed`.
- Output includes `package.json still has "private": true`.

- [ ] **Step 4: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: `tsc --noEmit` exits with code 0.

- [ ] **Step 5: Run lint**

Run:

```bash
pnpm lint
```

Expected: `eslint .` exits with code 0.

- [ ] **Step 6: Run format check**

Run:

```bash
pnpm format:check
```

Expected: `All matched files use Prettier code style!`

- [ ] **Step 7: Update project log validation table**

In `solace-project-log/solace-entries/2026-07-14-001-release-publish-readiness.md`, replace:

```md
- 状态：验证中
```

with:

```md
- 状态：已完成
```

Replace the verification rows:

```md
| Readiness default | `pnpm release:readiness` | 待执行 |
| Readiness publishable | `pnpm release:readiness -- --publishable` | 待执行 |
| Typecheck | `pnpm typecheck` | 待执行 |
| Lint | `pnpm lint` | 待执行 |
| 格式检查 | `pnpm format:check` | 待执行 |
```

with:

```md
| Readiness default | `pnpm release:readiness` | 通过，默认模式通过并提示当前 package 仍为 private |
| Readiness publishable | `pnpm release:readiness -- --publishable` | 预期失败，当前 `"private": true` 阻止 publishable 模式 |
| Typecheck | `pnpm typecheck` | 通过，无类型错误 |
| Lint | `pnpm lint` | 通过，无 ESLint 错误 |
| 格式检查 | `pnpm format:check` | 通过，所有匹配文件符合 Prettier 风格 |
```

- [ ] **Step 8: Run final format check**

Run:

```bash
pnpm format:check
```

Expected: `All matched files use Prettier code style!`

- [ ] **Step 9: Confirm publish state did not change**

Run:

```bash
node -e "const pkg = require('./package.json'); if (pkg.private !== true) process.exit(1); console.log('private remains true')"
```

Expected:

- Exits with code 0.
- Output includes `private remains true`.
