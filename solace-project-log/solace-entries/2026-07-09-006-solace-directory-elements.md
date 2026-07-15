# 2026-07-09-006：统一生成目录的 Solace 命名元素

## 基本信息

- 日期：2026-07-09
- 类型：项目结构
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

将当前项目下已生成的目录统一加入 `Solace` 命名元素。项目计划目录、项目日志目录、日志条目目录和所有阶段目录均已改为带 `solace` 前缀的目录名。

## 变动原因

用户要求当前项目下生成的目录都要有框架名称元素。此前目录仍使用 `project-plan`、`project-log`、`phase-*` 等通用名称，与已正式命名的 `Solace` 项目不完全一致。

## 影响范围

- 影响模块：项目目录结构、项目计划文档、项目日志文档、Markdown 相对链接。
- 影响对象：后续文件访问路径、执行计划入口、日志入口、阶段目录路径。
- 行为变化：没有运行时代码变化；目录名和文档路径引用发生变化。
- 风险等级：中低；如果外部脚本或书签硬编码旧路径，需要同步更新。

## 涉及目录

| 原目录                                     | 新目录                                                   | 说明            |
| ------------------------------------------ | -------------------------------------------------------- | --------------- |
| `project-plan/`                            | `solace-project-plan/`                                   | 项目计划目录    |
| `project-log/`                             | `solace-project-log/`                                    | 项目日志目录    |
| `project-log/entries/`                     | `solace-project-log/solace-entries/`                     | 日志条目目录    |
| `project-plan/phase-00-foundation/`        | `solace-project-plan/solace-phase-00-foundation/`        | 阶段 0 计划目录 |
| `project-plan/phase-01-reactivity/`        | `solace-project-plan/solace-phase-01-reactivity/`        | 阶段 1 计划目录 |
| `project-plan/phase-02-renderer/`          | `solace-project-plan/solace-phase-02-renderer/`          | 阶段 2 计划目录 |
| `project-plan/phase-03-components-events/` | `solace-project-plan/solace-phase-03-components-events/` | 阶段 3 计划目录 |
| `project-plan/phase-04-scheduler-store/`   | `solace-project-plan/solace-phase-04-scheduler-store/`   | 阶段 4 计划目录 |
| `project-plan/phase-05-compiler-tooling/`  | `solace-project-plan/solace-phase-05-compiler-tooling/`  | 阶段 5 计划目录 |
| `project-plan/phase-06-quality-release/`   | `solace-project-plan/solace-phase-06-quality-release/`   | 阶段 6 计划目录 |

## 涉及文件

| 文件                                                                            | 动作 | 说明                                         |
| ------------------------------------------------------------------------------- | ---- | -------------------------------------------- |
| `solace-project-plan/**`                                                        | 修改 | 同步计划文档中的阶段目录链接和路径说明       |
| `solace-project-log/**`                                                         | 修改 | 同步日志目录链接、索引和历史记录中的路径说明 |
| `solace-project-log/solace-entries/2026-07-09-006-solace-directory-elements.md` | 新增 | 记录本次目录命名统一变更                     |

## 验证记录

| 验证项             | 命令或方式                                               | 结果                                       |
| ------------------ | -------------------------------------------------------- | ------------------------------------------ |
| 目录命名检查       | `find . -type d \| sort`                                 | 通过，当前生成目录均包含 `solace` 命名元素 |
| 非 Solace 目录检查 | `find . -mindepth 1 -type d ! -iname '*solace*' \| sort` | 通过，未发现缺少 `solace` 元素的生成目录   |
| 重复前缀检查       | `rg -n "solace-solace                                    | 2026-07-09-002-solace-project-plan-created | 2026-07-09-003-solace-project-log-created" . -g '!solace-project-log/solace-entries/2026-07-09-006-solace-directory-elements.md'` | 通过，未发现重复前缀或误改日志文件名引用 |
| Markdown 链接检查  | Node 脚本检查 Markdown 相对链接和代码块围栏              | 通过，所有相对链接有效，代码块围栏闭合     |

## 后续动作

- 后续新增目录时，默认使用 `solace-*` 或包含 `Solace` 语义的目录名。
- 后续文档中引用项目计划和项目日志时，统一使用 `solace-project-plan` 与 `solace-project-log`。
