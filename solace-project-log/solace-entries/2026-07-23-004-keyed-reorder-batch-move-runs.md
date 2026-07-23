# 2026-07-23-004：批量移动连续 keyed children

## 基本信息

- 日期：2026-07-23
- 类型：renderer performance / browser benchmark / documentation / project log
- 状态：已完成

## 变动摘要

在 keyed reorder 移动循环中，将连续移动的既有 DOM 节点收集为 run，并通过 `DocumentFragment`
执行一次批量插入。同步扩展 move-path instrumentation、单元测试、浏览器 benchmark 断言、性能文档和项目日志。

## 变动原因

此前 `reverse`、`shuffle`、`shift-window` 等高移动量 keyed reorder shape 会对每个需要移动的既有节点调用一次
`insertBefore`。这些节点在很多场景中是连续 run，可以先移动到 `DocumentFragment`，再由浏览器用一次父节点插入完成整段移动，
从而降低 DOM mutation 次数，同时保留原有 keyed diff、LIS 稳定节点判断和节点身份复用语义。

## 影响范围

- `src/renderer/diff.ts` 的 keyed middle segment 移动循环。
- `src/renderer/keyed-reorder-instrumentation.ts` 的 move-path 诊断计数。
- `tests/unit/renderer/diff.test.ts` 的 keyed reorder 单元覆盖。
- `tests/e2e/browser-benchmark.spec.ts` 与 browser history 类型/fixture。
- `docs/performance.md` 的 latest-window 浏览器趋势摘要。
- API / DevTools 文档中的公开包名说明。
- 开源推广文档、发布状态文档和 changeset release note。

## 涉及文件

| 文件                                                                                | 动作 | 说明                                                       |
| ----------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------- |
| `src/renderer/diff.ts`                                                              | 修改 | 批量移动连续 moved existing children                       |
| `src/renderer/keyed-reorder-instrumentation.ts`                                     | 修改 | 新增 `movedExistingBatches` 计数                           |
| `tests/unit/renderer/diff.test.ts`                                                  | 修改 | 覆盖批量移动 run、benchmark 断言和 Set 分配边界            |
| `tests/e2e/browser-benchmark-history.ts`                                            | 修改 | 扩展 browser benchmark history 类型                        |
| `tests/e2e/browser-benchmark.spec.ts`                                               | 修改 | 更新 DOM mutation 与 move-path benchmark 断言              |
| `tests/unit/scripts/browser-benchmark-history.test.ts`                              | 修改 | 同步 history fixture                                       |
| `docs/api.md`                                                                       | 修改 | 扩充 API 说明并统一 `@italone/solace` 导入名               |
| `docs/api.zh-CN.md`                                                                 | 新增 | 中文 API 文档并统一 `@italone/solace` 导入名               |
| `docs/devtools.md`                                                                  | 修改 | 统一 DevTools public subpath 为 `@italone/solace/devtools` |
| `docs/performance.md`                                                               | 修改 | 刷新 5 样本 latest-window 浏览器 benchmark 摘要            |
| `docs/package-usage.md`                                                             | 修改 | 明确当前 `private: true` 下不是 registry publishable       |
| `docs/release.md`                                                                   | 修改 | 统一发布状态说明和 publishable 前置条件                    |
| `readme.md`                                                                         | 修改 | 链接开源基础文件、补充 Alpha scope 和推广向文档入口        |
| `readme.zh-CN.md`                                                                   | 修改 | 同步中文 README 的开源入口和 Alpha scope                   |
| `CONTRIBUTING.md`                                                                   | 新增 | 贡献指南                                                   |
| `SECURITY.md`                                                                       | 新增 | 安全报告与边界说明                                         |
| `LICENSE`                                                                           | 新增 | MIT License                                                |
| `.changeset/keyed-reorder-batch-move-runs.md`                                       | 新增 | patch release note                                         |
| `solace-project-log/index.md`                                                       | 修改 | 追加 004 索引行                                            |
| `solace-project-log/solace-entries/2026-07-23-004-keyed-reorder-batch-move-runs.md` | 新增 | 本日志                                                     |
| `docs/superpowers/plans/2026-07-23-keyed-reorder-batch-move-runs.md`                | 新增 | 实现计划                                                   |
| `docs/superpowers/specs/2026-07-23-keyed-reorder-batch-move-runs-design.md`         | 新增 | 设计说明                                                   |

## 验证记录

| 验证项                | 命令                                                                                                                                   | 结果                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Unit tests            | `pnpm vitest run tests/unit/renderer/diff.test.ts tests/unit/scripts/browser-benchmark-history.test.ts`                                | 通过                                          |
| Full unit/integration | `pnpm test`                                                                                                                            | 通过                                          |
| Quality gate          | `pnpm quality`                                                                                                                         | 通过                                          |
| Coverage              | `pnpm test:coverage`                                                                                                                   | 通过                                          |
| Package smoke         | `pnpm package:smoke`                                                                                                                   | 通过                                          |
| jsdom benchmark       | `pnpm benchmark`                                                                                                                       | 通过                                          |
| Browser benchmark     | `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=5 pnpm benchmark:browser` | 通过                                          |
| Browser e2e           | `pnpm test:e2e`                                                                                                                        | 通过                                          |
| History summary       | `pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json`                                                      | 通过                                          |
| Type check            | `pnpm typecheck`                                                                                                                       | 通过                                          |
| Lint                  | `pnpm lint`                                                                                                                            | 通过                                          |
| Format check          | `pnpm format:check`                                                                                                                    | 通过                                          |
| Whitespace check      | `git diff --check`                                                                                                                     | 通过                                          |
| Publishable readiness | `pnpm release:readiness -- --publishable`                                                                                              | 预期失败：`package.json` 仍为 `private: true` |
| npm registry check    | `npm view @italone/solace version --json`                                                                                              | 返回 `"0.0.1"`                                |

## Browser latest-window summary

`pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json` 汇总的最新 5 样本显示：

| Scenario                       | Main metric | Median | p95 | DOM / move-path note                                                              |
| ------------------------------ | ----------- | ------ | --- | --------------------------------------------------------------------------------- |
| `large-list`                   | `updateMs`  | 3.1    | 5.4 | 10,000 row selected update                                                        |
| `keyed-reorder:reverse`        | `reorderMs` | 7      | 8.9 | `insertBefore: 1`, `movedExistingChildren: 9999`, `movedExistingBatches: 1`       |
| `keyed-reorder:sorted`         | `reorderMs` | 2.8    | 3.2 | `insertBefore: 0`, no moved existing children                                     |
| `keyed-reorder:swap-neighbors` | `reorderMs` | 4      | 5.1 | `insertBefore: 5000`, `movedExistingBatches: 0` because moved nodes are separated |
| `keyed-reorder:shuffle`        | `reorderMs` | 6.5    | 7.9 | `insertBefore: 193`, `movedExistingChildren: 9805`, `movedExistingBatches: 191`   |
| `keyed-reorder:shift-window`   | `reorderMs` | 3.9    | 5   | `insertBefore: 1`, `movedExistingBatches: 1`                                      |

All keyed reorder shapes continue to report `movePathCounts.anchorLookups: 0`.

## 后续动作

- 若准备对外发布，需要由维护者确认 `@italone` scope / `@italone/solace` 包权限、去除 `private: true`，
  并重新执行 publishable readiness gate。
