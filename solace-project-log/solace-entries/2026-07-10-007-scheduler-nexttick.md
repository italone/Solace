# 2026-07-10-007：实现 scheduler 与 nextTick

## 基本信息

- 日期：2026-07-10
- 类型：源码 / 测试
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

新增微任务 scheduler，提供 `queueJob` 去重入队和 `nextTick` flush 后等待能力。为当前 mount-only renderer 增加函数式 render source 桥接，使响应式状态在同一 tick 内多次变更时只触发一次批量 DOM 更新。

## 变动原因

响应式更新需要统一调度，避免同一轮状态变更重复执行渲染任务。scheduler 是后续组件渲染、DOM diff 和异步更新语义的基础。

## 影响范围

- 影响模块：scheduler、renderer、公开 API、单元测试、集成测试。
- 影响对象：`queueJob`、`nextTick`、函数式 `render(() => VNode, container)`。
- 行为变化：新增任务队列与 `nextTick`；函数式 render source 会通过 `ReactiveEffect` 和 scheduler 批处理更新。
- 风险等级：中；当前 renderer 仍是 remount bridge，后续 DOM diff 会替换为精细 patch。

## 涉及文件

| 文件                                                                     | 动作 | 说明                                                               |
| ------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------ |
| `src/scheduler/scheduler.ts`                                             | 新增 | 实现微任务 job queue、同 flush 去重和 `nextTick`                   |
| `src/renderer/renderer.ts`                                               | 修改 | 增加函数式 render source、scheduled render effect 和旧 effect 清理 |
| `src/index.ts`                                                           | 修改 | 导出 `nextTick` 与 `queueJob`                                      |
| `tests/unit/scheduler/scheduler.test.ts`                                 | 新增 | 覆盖去重、顺序、`nextTick`、flush 期间入队                         |
| `tests/integration/batched-render.test.ts`                               | 新增 | 覆盖同 tick 批量 render、旧 render effect 替换和 stale queued job  |
| `solace-project-log/solace-entries/2026-07-10-007-scheduler-nexttick.md` | 新增 | 记录本次 scheduler 变更                                            |
| `solace-project-log/index.md`                                            | 修改 | 追加本次变更索引                                                   |

## 验证记录

| 验证项                       | 命令或方式                                                                                  | 结果                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| TDD RED：scheduler 初始测试  | `pnpm test tests/unit/scheduler/scheduler.test.ts tests/integration/batched-render.test.ts` | 失败符合预期，`queueJob is not a function` 且函数式 render 未更新 DOM |
| TDD RED：同 flush 自重入     | `pnpm test tests/unit/scheduler/scheduler.test.ts`                                          | 失败符合预期，自重入 job 导致队列无限追加                             |
| TDD RED：stale queued render | `pnpm test tests/integration/batched-render.test.ts`                                        | 失败符合预期，旧 render source 被再次调用且静态替换未清空旧 DOM       |
| scheduler 单元测试           | `pnpm test tests/unit/scheduler/scheduler.test.ts`                                          | 通过，1 个测试文件、5 个测试                                          |
| 批处理渲染集成测试           | `pnpm test tests/integration/batched-render.test.ts`                                        | 通过，1 个测试文件、4 个测试                                          |
| 类型检查                     | `pnpm typecheck`                                                                            | 通过，退出码为 0                                                      |
| 静态检查                     | `pnpm lint`                                                                                 | 通过，退出码为 0                                                      |
| 全量质量门禁                 | `pnpm quality`                                                                              | 通过，5 个测试文件、27 个测试，构建通过                               |

## 后续动作

- 继续阶段 2 Step 02，实现 DOM patch、children diff 和 keyed diff。
- 在 keyed diff 前为 `VNode` 增加 normalized `key` 字段，并补充 props/event patch 测试。
