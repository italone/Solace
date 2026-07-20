# 2026-07-20-012：优化 initial class mount fast path

## 基本信息

- 日期：2026-07-20
- 类型：renderer performance / unit test / performance docs / project log
- 状态：已完成

## 变动摘要

为 renderer element initial mount 增加 `class` fast path：HTML 元素上的 `class` 直接写入 `className`，
非 HTML 节点仍走 attribute fallback。

## 影响范围

- 影响模块：renderer element mount、renderer 单元测试、component benchmark、browser benchmark trend、性能文档、项目日志。
- 行为变化：无 public API 变化；update-time props patching 保持不变，event props 仍沿用现有路径。
- 风险等级：中低；主要风险是 non-HTML class 语义变化，已用 HTML class、mixed props、event 和 update tests 覆盖。

## 涉及文件

| 文件                                                                                | 动作 | 说明                               |
| ----------------------------------------------------------------------------------- | ---- | ---------------------------------- |
| `src/renderer/diff.ts`                                                              | 修改 | 增加 initial class mount fast path |
| `tests/unit/renderer/diff.test.ts`                                                  | 修改 | 覆盖 initial class mount 回归      |
| `docs/performance.md`                                                               | 修改 | 记录本次 renderer 性能优化         |
| `solace-project-log/solace-entries/2026-07-20-012-initial-class-mount-fast-path.md` | 新增 | 记录本次变更                       |
| `solace-project-log/index.md`                                                       | 修改 | 追加 2026-07-20 日志索引           |

## 验证记录

| 验证项                 | 命令或方式                                                                                                                             | 结果                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| TDD RED                | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                                                                     | 通过，新测试先以 `setAttribute("class", ...)` 失败                          |
| Targeted renderer test | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                                                                     | 通过，1 file / 26 tests                                                     |
| Event test             | `pnpm vitest run tests/unit/event/event.test.ts`                                                                                       | 通过，1 file / 6 tests                                                      |
| Component benchmark    | `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/render.bench.ts`                                           | 通过，1 file / 1 test                                                       |
| List diff benchmark    | `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts`                                        | 通过，1 file / 1 test                                                       |
| Browser benchmark      | `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=5 pnpm benchmark:browser` | 通过，5 samples；沙箱内首次因 `127.0.0.1:5177` listen EPERM，提升权限后通过 |
| Browser history        | `pnpm benchmark:history -- --min-browser-count 20 --json`                                                                              | 通过，browser records 45；median: 7.7 / 3.6 / 1.2 ms                        |
| Browser history        | `pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json`                                                      | 通过，latest browser records 5；median: 7.7 / 4.0 / 1.2 ms                  |
| Full tests             | `pnpm test`                                                                                                                            | 通过，23 files / 180 tests                                                  |
| Typecheck              | `pnpm typecheck`                                                                                                                       | 通过                                                                        |
| Lint                   | `pnpm lint`                                                                                                                            | 通过                                                                        |
| Build                  | `pnpm build`                                                                                                                           | 通过                                                                        |
| Format check           | `pnpm format:check`                                                                                                                    | 通过                                                                        |
| Diff whitespace        | `git diff --check`                                                                                                                     | 通过                                                                        |
| Private boundary       | `package.json`                                                                                                                         | 保持 `"private": true`                                                      |

## 后续动作

- 根据本次 browser trend refresh 再判断下一轮性能切片；发布线仍受 `"private": true` 门禁约束。
