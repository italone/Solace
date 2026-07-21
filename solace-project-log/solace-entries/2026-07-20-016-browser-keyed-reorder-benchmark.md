# 2026-07-20-016：扩展 browser keyed reorder benchmark

## 基本信息

- 日期：2026-07-20
- 类型：browser benchmark / benchmark history / performance docs / project log
- 状态：已完成

## 变动摘要

将 Chromium production browser benchmark 从单一 `large-list` 场景扩展为 `large-list` 与
`keyed-reorder` 双场景。新增 keyed reorder 场景会挂载 10,000 个 keyed row，反转顺序并记录
`reorderMs`，再验证首行变为 `Row 10000` 且 unmount 后无残留 row 节点。

## 变动原因

发布第一版后，性能线继续按计划补浏览器侧 keyed reorder 信号。jsdom benchmark 已显示
`10000 row keyed reorder` 是当前热点之一；进入 renderer 优化前，需要先让 Chromium production
benchmark 和 history summary 能记录该场景。

## 影响范围

- 影响模块：browser benchmark fixture、Playwright browser benchmark、browser history 类型、history summary、性能文档、项目日志。
- 行为变化：`pnpm benchmark:browser` 每个 sample 会运行 `large-list` 和 `keyed-reorder` 两个场景，并输出两条 `browser benchmark summary`。
- 风险等级：中低；仅扩展 benchmark harness，不改 renderer diff、public API、package exports 或发布阈值。

## 涉及文件

| 文件                                                   | 动作 | 说明                                     |
| ------------------------------------------------------ | ---- | ---------------------------------------- |
| `examples/performance-benchmark/src/main.tsx`          | 修改 | 增加 named scenario API 与 keyed reorder |
| `tests/e2e/browser-benchmark.spec.ts`                  | 修改 | 每个 sample 运行并校验两个 browser 场景  |
| `tests/e2e/browser-benchmark-history.ts`               | 修改 | 扩展 browser history result union        |
| `scripts/summarize-benchmark-history.mjs`              | 修改 | 将 `reorderMs` 纳入 browser metrics      |
| `tests/unit/scripts/browser-benchmark-history.test.ts` | 修改 | 覆盖 keyed reorder history append        |
| `tests/unit/scripts/benchmark-history-summary.test.ts` | 修改 | 覆盖 keyed reorder `reorderMs` 汇总      |
| `docs/performance.md`                                  | 修改 | 记录 browser keyed reorder 场景          |
| `solace-project-log/index.md`                          | 修改 | 追加 2026-07-20 日志索引                 |

## 验证记录

| 验证项                    | 命令或方式                                                                                                                  | 结果                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Browser history unit      | `pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts tests/unit/scripts/benchmark-history-summary.test.ts` | 通过，2 files / 17 tests                                          |
| TypeScript                | `pnpm typecheck`                                                                                                            | 通过                                                              |
| Browser benchmark         | `pnpm benchmark:browser`                                                                                                    | 通过，Chromium `large-list` 与 `keyed-reorder` 各输出一条 summary |
| Browser benchmark sandbox | `pnpm benchmark:browser`                                                                                                    | 沙箱内失败于 `listen EPERM 127.0.0.1:5177`，提升权限后通过        |

## 后续动作

- 用 `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=5 pnpm benchmark:browser`
  追加 keyed reorder 样本，再用 `pnpm benchmark:history -- --latest-browser-count 5 --json` 观察新场景趋势。
- 基于新的 browser keyed reorder 窗口选择下一轮 renderer 性能优化切片。
