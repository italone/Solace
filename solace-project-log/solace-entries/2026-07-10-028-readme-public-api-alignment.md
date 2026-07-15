# 2026-07-10-028：对齐 README 当前公共 API 说明

## 基本信息

- 日期：2026-07-10
- 类型：文档 / API 准确性
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

将 README 设计背景中的“建议第一阶段公开 API”改为“当前 package root 公共 API”，并把 `defineComponent()`、`provide()`、`inject()`、`watchEffect()` 标记为后续候选 API。当前文档不再把未实现能力写成已公开能力。

## 变动原因

package root API 已经收紧，README 仍保留旧 API 草案会误导使用者认为 `defineComponent/provide/inject/watchEffect` 已经可从 `solace` 导入。更新后 README 与 `docs/api.md` 和 `src/index.ts` 的实际导出保持一致。

## 影响范围

- 影响模块：README 文档。
- 影响对象：当前公共 API 列表、后续候选 API 说明。
- 行为变化：无运行时行为变化。
- 风险等级：低；仅修正文档表述。

## 涉及文件

| 文件                                                                              | 动作 | 说明                                               |
| --------------------------------------------------------------------------------- | ---- | -------------------------------------------------- |
| `readme.md`                                                                       | 修改 | 对齐当前 package root 公共 API，标注未实现候选 API |
| `solace-project-log/solace-entries/2026-07-10-028-readme-public-api-alignment.md` | 新增 | 记录本次 README API 说明修正                       |
| `solace-project-log/index.md`                                                     | 修改 | 追加本次变更索引                                   |

## 验证记录

| 验证项              | 命令或方式                         | 结果                                                                            |
| ------------------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| README API 引用检查 | `rg -n "当前 package root 公共 API | 后续候选 API                                                                    | defineComponent\\(\\) | provide\\(\\) | inject\\(\\) | watchEffect\\(\\)" readme.md docs` | 通过，未实现 API 已标为后续候选 |
| 全量质量门禁        | `pnpm quality`                     | 通过，typecheck、JSX dev typecheck、lint、默认测试和 package exports 测试均通过 |

## 后续动作

- 后续新增或移除 package root API 时，应同步更新 README 和 `docs/api.md`。
