# 2026-07-10-025：新增示例使用文档

## 基本信息

- 日期：2026-07-10
- 类型：文档 / 示例
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

新增 `docs/examples.md`，集中说明 basic counter、todo app 和 large list 三个 Vite 示例的运行命令、覆盖的框架能力、Playwright e2e 覆盖点和固定端口。README、架构文档和包使用文档增加到示例文档的链接。

## 变动原因

示例目录已经完整，但此前没有单独文档说明每个示例验证什么能力、如何运行以及 e2e 如何覆盖。新增 examples guide 可以降低后续维护和验收成本。

## 影响范围

- 影响模块：examples docs、README、architecture docs、package usage docs。
- 影响对象：示例运行说明、e2e 覆盖说明、发布包 docs 清单。
- 行为变化：无运行时行为变化。
- 风险等级：低；仅新增和链接文档。

## 涉及文件

| 文件                                                                 | 动作 | 说明                                        |
| -------------------------------------------------------------------- | ---- | ------------------------------------------- |
| `docs/examples.md`                                                   | 新增 | 记录三个示例的运行命令、能力覆盖和 e2e 验证 |
| `readme.md`                                                          | 修改 | 增加 examples guide 链接                    |
| `docs/package-usage.md`                                              | 修改 | 增加 examples guide 指引                    |
| `docs/architecture.md`                                               | 修改 | 增加 examples 章节                          |
| `solace-project-log/solace-entries/2026-07-10-025-examples-guide.md` | 新增 | 记录本次示例文档变更                        |
| `solace-project-log/index.md`                                        | 修改 | 追加本次变更索引                            |

## 验证记录

| 验证项                 | 命令或方式               | 结果                                                                             |
| ---------------------- | ------------------------ | -------------------------------------------------------------------------------- |
| 文档引用检查           | `rg -n "docs/examples.md | Basic Counter                                                                    | Todo App | Large List | 5174 | 5175 | 5176" docs readme.md` | 通过，示例文档和入口链接可检索 |
| 全量质量门禁           | `pnpm quality`           | 通过，typecheck、JSX dev typecheck、lint、build、14 个测试文件和 74 个测试均通过 |
| package consumer smoke | `pnpm package:smoke`     | 通过，tarball 包含 `docs/examples.md` 并可被临时消费者安装使用                   |

## 后续动作

- 后续如新增示例，应同步更新 `docs/examples.md`、Playwright 配置和 e2e 覆盖说明。
