# 2026-07-10-022：修正 store action 文档上下文类型

## 基本信息

- 日期：2026-07-10
- 类型：文档 / API 准确性
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

修正 `docs/api.md` 中 `createStore` action 示例的上下文类型，将 `StoreGetterContext` 改为 `StoreContext`。getter 使用 `StoreGetterContext`，action 实际接收包含 state、getters 和 actions 的 `StoreContext`。

## 变动原因

公开 API 文档应与实现类型保持一致。旧示例虽然只解构 `state`，但类型名会误导使用者把 getter context 用在 action 中。

## 影响范围

- 影响模块：API 文档。
- 影响对象：store action 类型示例。
- 行为变化：无运行时行为变化。
- 风险等级：低；仅修正文档示例类型。

## 涉及文件

| 文件                                                                           | 动作 | 说明                                        |
| ------------------------------------------------------------------------------ | ---- | ------------------------------------------- |
| `docs/api.md`                                                                  | 修改 | 将 action 示例上下文类型改为 `StoreContext` |
| `solace-project-log/solace-entries/2026-07-10-022-store-action-doc-context.md` | 新增 | 记录本次 API 文档修正                       |
| `solace-project-log/index.md`                                                  | 修改 | 追加本次变更索引                            |

## 验证记录

| 验证项       | 命令或方式           | 结果                             |
| ------------ | -------------------- | -------------------------------- |
| 文档引用检查 | `rg -n "StoreContext | StoreGetterContext" docs/api.md` | 通过，getter 和 action 示例分别使用对应 context 类型 |

## 后续动作

- 后续新增 API 示例时，应优先复用源码导出的公开类型名，避免示例类型和实现语义漂移。
