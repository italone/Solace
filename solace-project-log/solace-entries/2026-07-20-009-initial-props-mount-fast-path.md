# 2026-07-20-009：优化 initial props mount fast path

## 基本信息

- 日期：2026-07-20
- 类型：renderer performance / unit test / performance docs / project log
- 状态：已完成

## 变动摘要

为 renderer element initial mount 增加 props fast path：普通初始属性不再走 `Object.entries()` 和通用 prop patch
路径，fresh element 上的空值 props 不再触发冗余 `removeAttribute()`。

## 影响范围

- 影响模块：renderer element mount、renderer 单元测试、list diff benchmark、browser benchmark trend、性能文档、项目日志。
- 行为变化：无 public API 变化；event props 仍委托现有 `patchProp()`，update-time props patching 保持不变。
- 风险等级：中低；主要风险是 initial mount prop 语义变化，已用普通属性、空值属性、event、update props 测试覆盖。

## 涉及文件

| 文件                                                                                | 动作 | 说明                                   |
| ----------------------------------------------------------------------------------- | ---- | -------------------------------------- |
| `src/renderer/diff.ts`                                                              | 修改 | 增加 initial props mount fast path     |
| `tests/unit/renderer/diff.test.ts`                                                  | 修改 | 覆盖初始 props scan 与空值 remove 回归 |
| `docs/performance.md`                                                               | 修改 | 记录本次 renderer 性能优化             |
| `solace-project-log/solace-entries/2026-07-20-009-initial-props-mount-fast-path.md` | 新增 | 记录本次变更                           |
| `solace-project-log/index.md`                                                       | 修改 | 追加 2026-07-20 日志索引               |

## 验证记录

| 验证项                 | 命令或方式                                                                                                                             | 结果                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| TDD RED                | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                                                                     | 通过，新测试先以 `Object.entries()` 1 次和 `removeAttribute()` 3 次失败     |
| Targeted renderer test | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                                                                     | 通过，1 file / 24 tests                                                     |
| Event test             | `pnpm vitest run tests/unit/event/event.test.ts`                                                                                       | 通过，1 file / 6 tests                                                      |
| List diff benchmark    | `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts`                                        | 通过，1 file / 1 test                                                       |
| Browser benchmark      | `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=5 pnpm benchmark:browser` | 通过，5 samples；沙箱内首次因 `127.0.0.1:5177` listen EPERM，提升权限后通过 |
| Full browser history   | `pnpm benchmark:history -- --min-browser-count 20 --json`                                                                              | 通过，browser records 40；median: 7.9 / 3.5 / 1.2 ms                        |
| Latest browser history | `pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json`                                                      | 通过，latest browser records 5；median: 6.9 / 3.5 / 1.1 ms                  |
| Full tests             | `pnpm test`                                                                                                                            | 通过，23 files / 180 tests                                                  |
| Typecheck              | `pnpm typecheck`                                                                                                                       | 通过                                                                        |
| Lint                   | `pnpm lint`                                                                                                                            | 通过                                                                        |
| Build                  | `pnpm build`                                                                                                                           | 通过                                                                        |
| Format check           | `pnpm format:check`                                                                                                                    | 通过                                                                        |
| Diff whitespace        | `git diff --check`                                                                                                                     | 通过                                                                        |
| Private boundary       | `package.json`                                                                                                                         | 保持 `"private": true`                                                      |

## 后续动作

- 根据本次 browser trend refresh 再判断下一轮性能切片；发布线仍受 `"private": true` 门禁约束。
