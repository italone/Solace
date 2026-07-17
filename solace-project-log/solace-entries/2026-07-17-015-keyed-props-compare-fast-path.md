# 2026-07-17-015：优化 keyed props compare fast path

## 基本信息

- 日期：2026-07-17
- 类型：renderer performance / unit test / performance docs / project log
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

为 renderer element patch 增加 props comparison 快速路径：child-only keyed update 不再执行无意义的 prop patching，也避免在 key-only props 场景中调用 `Object.keys()` 扫描 props。

## 变动原因

最新 browser benchmark trend 显示 10,000 行 large-list selected-row update 是当前有基准支撑的优化方向。相比继续扩展 Fragment 或 component batching，本次切片只收紧 renderer props comparison 和 child-only update 路径，风险更低。

## 影响范围

- 影响模块：renderer diff、renderer 单元测试、性能文档、项目日志。
- 行为变化：无 public API 变化；changed/added/removed non-key props 仍按原语义 patch。
- 风险等级：中低；主要风险是误判 props 未变化，已用现有 props/event 测试和新增 key-only child update 测试覆盖。

## 涉及文件

| 文件                                                                                | 动作 | 说明                                               |
| ----------------------------------------------------------------------------------- | ---- | -------------------------------------------------- |
| `src/renderer/diff.ts`                                                              | 修改 | 增加 props comparison fast path 和 child-only skip |
| `tests/unit/renderer/diff.test.ts`                                                  | 修改 | 增加 key-only child update props scan 回归测试     |
| `docs/performance.md`                                                               | 修改 | 记录本次 renderer 性能优化                         |
| `solace-project-log/solace-entries/2026-07-17-015-keyed-props-compare-fast-path.md` | 新增 | 记录本次变更                                       |
| `solace-project-log/index.md`                                                       | 修改 | 追加 2026-07-17 日志索引                           |

## 验证记录

| 验证项                 | 命令或方式                                                                                      | 结果                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| TDD RED                | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 按预期失败，新增测试捕获 `Object.keys` 被调用 30 次                                  |
| Targeted renderer test | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 通过，1 file / 22 tests                                                              |
| List diff benchmark    | `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts` | 通过，1 file / 1 test                                                                |
| Tests                  | `pnpm test`                                                                                     | 通过，23 files / 175 tests                                                           |
| Typecheck              | `pnpm typecheck`                                                                                | 通过                                                                                 |
| Lint                   | `pnpm lint`                                                                                     | 通过                                                                                 |
| Build                  | `pnpm build`                                                                                    | 通过                                                                                 |
| 格式检查               | `pnpm format:check`                                                                             | 通过                                                                                 |
| Diff whitespace        | `git diff --check`                                                                              | 通过                                                                                 |
| Package checks         | `pnpm test:package`, `pnpm package:smoke`                                                       | 跳过；未修改 package exports、Rollup、`src/devtools/index.ts` 或 public entry points |
| Private boundary       | `package.json`                                                                                  | 保持 `"private": true`                                                               |

## 后续动作

- 后续 renderer 性能优化继续以 benchmark 和 narrow TDD regression 为入口；不要在没有稳定性信号的情况下扩大 keyed diff 重写范围。
