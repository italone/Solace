# 2026-07-10-024：补充覆盖率回归测试

## 基本信息

- 日期：2026-07-10
- 类型：测试 / 覆盖率
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

补充 JSX runtime、VNode children 归一化、scheduler、DOM event cleanup 和组件 emit 边界测试。新增测试不改变运行时实现，主要用于锁住已有语义并提高覆盖率门禁余量。

## 变动原因

接入覆盖率阈值后，低覆盖分支显示 JSX dev runtime、JSX children normalize、单 VNode child normalize、`nextTick(callback)`、无 invoker 事件清理、kebab-case emit 和数组监听器等路径缺少直接回归测试。补齐这些测试可以减少未来重构时的回归风险。

## 影响范围

- 影响模块：renderer tests、scheduler tests、event tests、component lifecycle tests。
- 影响对象：`jsxDEV`、JSX primitive/mixed children、single VNode child、`nextTick(callback)`、`removeEvents` 空 invoker、component emit kebab-case 和 listener array。
- 行为变化：无运行时行为变化；测试数量从 66 增加到 74。
- 风险等级：低；仅新增测试。

## 涉及文件

| 文件                                                                            | 动作 | 说明                                               |
| ------------------------------------------------------------------------------- | ---- | -------------------------------------------------- |
| `tests/unit/renderer/jsx-runtime.test.ts`                                       | 修改 | 增加 JSX primitive/mixed children 和 `jsxDEV` 测试 |
| `tests/unit/renderer/vnode-render.test.ts`                                      | 修改 | 增加单 VNode child 归一化测试                      |
| `tests/unit/scheduler/scheduler.test.ts`                                        | 修改 | 增加 `nextTick(callback)` flush 顺序测试           |
| `tests/unit/event/event.test.ts`                                                | 修改 | 增加无 invoker 事件清理测试                        |
| `tests/unit/component/lifecycle.test.ts`                                        | 修改 | 增加 kebab-case emit 和数组监听器测试              |
| `solace-project-log/solace-entries/2026-07-10-024-coverage-regression-tests.md` | 新增 | 记录本次测试补充                                   |
| `solace-project-log/index.md`                                                   | 修改 | 追加本次变更索引                                   |

## 验证记录

| 验证项       | 命令或方式                                                                                                                                                                                                | 结果                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 定向测试     | `pnpm test tests/unit/renderer/jsx-runtime.test.ts tests/unit/renderer/vnode-render.test.ts tests/unit/scheduler/scheduler.test.ts tests/unit/event/event.test.ts tests/unit/component/lifecycle.test.ts` | 通过，5 个测试文件、27 个测试                                                                      |
| 覆盖率门禁   | `pnpm test:coverage`                                                                                                                                                                                      | 通过，14 个测试文件、74 个测试；statements 93.76%、branches 83.71%、functions 72.68%、lines 93.05% |
| 全量质量门禁 | `pnpm quality`                                                                                                                                                                                            | 通过，typecheck、JSX dev typecheck、lint、build、14 个测试文件和 74 个测试均通过                   |

## 后续动作

- 后续可继续针对 renderer diff 和 component lifecycle 的未覆盖边界补测试，再考虑提高函数覆盖率阈值。
