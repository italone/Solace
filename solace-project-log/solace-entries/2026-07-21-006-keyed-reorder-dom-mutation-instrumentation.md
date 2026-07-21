# 2026-07-21-006：补充 keyed reorder DOM mutation instrumentation

## 基本信息

- 日期：2026-07-21
- 类型：browser benchmark / performance instrumentation / project log
- 状态：已完成

## 变动摘要

在 Chromium browser keyed reorder benchmark 中补充 `domMutationCounts`，只统计 reorder update window 内的
`insertBefore`、`setAttribute`、`removeAttribute`、`textContent` 与 `removeChild` 调用次数。

## 变动原因

上一版 matched patch skip 计划被验证为不可执行：现有 `patchElement()` 已经具备稳定 element no-op 早退。新的切片先
记录真实 DOM mutation 信号，再决定后续优化 keyed diff bookkeeping、DOM move 路径，还是 props / children patch 重复成本。

## 影响范围

- 影响模块：browser benchmark fixture、browser benchmark history type、性能文档、项目日志。
- 行为变化：无 renderer runtime 行为变化；新增 benchmark 诊断字段。
- 风险等级：低；DOM prototype patching 只在 benchmark reorder update window 内生效，并在 `finally` 中恢复。

## 涉及文件

| 文件                                                                                             | 动作 | 说明                            |
| ------------------------------------------------------------------------------------------------ | ---- | ------------------------------- |
| `examples/performance-benchmark/src/main.tsx`                                                    | 修改 | 统计 keyed reorder DOM mutation |
| `tests/e2e/browser-benchmark.spec.ts`                                                            | 修改 | 校验 benchmark counter shape    |
| `tests/e2e/browser-benchmark-history.ts`                                                         | 修改 | 扩展 keyed reorder history type |
| `tests/unit/scripts/browser-benchmark-history.test.ts`                                           | 修改 | 覆盖 history counter 持久化     |
| `docs/performance.md`                                                                            | 修改 | 记录 counter 诊断语义           |
| `solace-project-log/solace-entries/2026-07-21-006-keyed-reorder-dom-mutation-instrumentation.md` | 新增 | 记录本次实现变更                |
| `solace-project-log/index.md`                                                                    | 修改 | 追加 2026-07-21 日志索引        |

## 验证记录

| 验证项               | 命令或方式                                                             | 结果                                        |
| -------------------- | ---------------------------------------------------------------------- | ------------------------------------------- |
| Browser history unit | `pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts` | 通过，6 tests                               |
| Browser benchmark    | `pnpm benchmark:browser`                                               | 通过，`keyed-reorder` summary 包含 counters |
| Typecheck            | `pnpm typecheck`                                                       | 通过                                        |

## 后续动作

- 基于 `domMutationCounts` 的最新 browser records 选择下一轮 renderer 性能切片。如果 prop/text counters 为零，优先
  研究 keyed diff bookkeeping 或 move path；如果它们不为零，再设计 patch 重复成本优化。
