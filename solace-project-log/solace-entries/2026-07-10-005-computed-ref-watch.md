# 2026-07-10-005：实现 computed、ref 与 watch

## 基本信息

- 日期：2026-07-10
- 类型：源码 / 测试
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

补齐 Solace 响应式核心的派生状态和监听能力，新增 `computed`、`ref` 与 `watch`。同时扩展 `ReactiveEffect` 的 scheduler、stop、依赖 cleanup 能力，并修复动态依赖切换、触发迭代和 ref 身份稳定性问题。

## 变动原因

后续渲染器和组件系统需要可缓存的派生状态、可独立跟踪的值容器，以及监听响应式数据变化的机制。`computed`、`ref` 与 `watch` 是从基础响应式走向渲染更新的必要中间层。

## 影响范围

- 影响模块：响应式核心、公开 API、单元测试。
- 影响对象：`ReactiveEffect`、`computed`、`ref`、`watch`。
- 行为变化：新增公开 API `computed`、`ref`、`watch`；effect rerun 前会清理旧依赖。
- 风险等级：中；`watch` 当前支持 getter source，后续可按组件需求扩展对象 source、立即执行等选项。

## 涉及文件

| 文件                                                                     | 动作 | 说明                                               |
| ------------------------------------------------------------------------ | ---- | -------------------------------------------------- |
| `src/reactivity/effect.ts`                                               | 修改 | 增加 scheduler、stop、依赖 cleanup 和稳定触发迭代  |
| `src/reactivity/computed.ts`                                             | 新增 | 实现 lazy、缓存和 dirty 失效的 computed ref        |
| `src/reactivity/ref.ts`                                                  | 新增 | 实现 `.value` 访问跟踪与写入触发                   |
| `src/reactivity/watch.ts`                                                | 新增 | 实现 getter source watch、新旧值回调和 stop handle |
| `src/index.ts`                                                           | 修改 | 导出 `computed`、`ref`、`watch`                    |
| `tests/unit/reactivity/computed-watch.test.ts`                           | 新增 | 覆盖 computed、ref、watch 行为                     |
| `tests/unit/reactivity/reactive-effect.test.ts`                          | 修改 | 增加动态依赖 cleanup 回归测试                      |
| `solace-project-log/solace-entries/2026-07-10-005-computed-ref-watch.md` | 新增 | 记录本次响应式扩展                                 |
| `solace-project-log/index.md`                                            | 修改 | 追加本次变更索引                                   |

## 验证记录

| 验证项                               | 命令或方式                                                | 结果                              |
| ------------------------------------ | --------------------------------------------------------- | --------------------------------- |
| TDD RED：computed/ref/watch 初始测试 | `pnpm test tests/unit/reactivity/computed-watch.test.ts`  | 失败符合预期，API 尚未导出        |
| TDD RED：动态依赖 cleanup 回归       | `pnpm test tests/unit/reactivity/reactive-effect.test.ts` | 失败符合预期，旧依赖仍触发 effect |
| computed/ref/watch 单元测试          | `pnpm test tests/unit/reactivity/computed-watch.test.ts`  | 通过，1 个测试文件、9 个测试      |
| 响应式单元测试                       | `pnpm test tests/unit/reactivity`                         | 通过，2 个测试文件、15 个测试     |
| 类型检查                             | `pnpm typecheck`                                          | 通过，退出码为 0                  |
| 静态检查                             | `pnpm lint`                                               | 通过，退出码为 0                  |

## 后续动作

- 继续按执行索引推进阶段 4 Step 01 的 scheduler/nextTick，随后进入阶段 2 渲染器。
- 后续如需要更完整的 watch 能力，可增加 immediate、deep、多 source 等选项。
