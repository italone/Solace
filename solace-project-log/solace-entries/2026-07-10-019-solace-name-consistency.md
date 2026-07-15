# 2026-07-10-019：清理当前文档中的旧框架名

## 基本信息

- 日期：2026-07-10
- 类型：文档 / 命名一致性
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

将当前 README 和项目计划入口中残留的旧临时名 `Aurora` / `aurora` 同步为正式名称 `Solace` / `solace`。历史变更日志中用于说明命名迁移过程的旧名保留不改。

## 变动原因

项目已正式采用 `Solace` 作为框架名，但当前文档中仍有旧包名示例、旧 Vite 插件目录示例和计划标题残留。清理这些引用可以避免后续开发者误用旧名称。

## 影响范围

- 影响模块：README、项目计划文档。
- 影响对象：monorepo 目录示例、代码导入示例、计划标题和基础 package name 示例。
- 行为变化：无运行时行为变化。
- 风险等级：低；仅修改文档中的命名。

## 涉及文件

| 文件                                                                          | 动作 | 说明                                                                   |
| ----------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `readme.md`                                                                   | 修改 | 将 `vite-plugin-aurora` 和 `import ... from "aurora"` 改为 Solace 命名 |
| `solace-project-plan/README.md`                                               | 修改 | 将计划标题和目标中的 Aurora 改为 Solace                                |
| `solace-project-plan/solace-phase-00-foundation/step-01-create-workspace.md`  | 修改 | 将 package name 示例改为 `solace`                                      |
| `solace-project-log/solace-entries/2026-07-10-019-solace-name-consistency.md` | 新增 | 记录本次命名一致性修正                                                 |
| `solace-project-log/index.md`                                                 | 修改 | 追加本次变更索引                                                       |

## 验证记录

| 验证项           | 命令或方式     | 结果                                   |
| ---------------- | -------------- | -------------------------------------- |
| 当前文档旧名扫描 | `rg -n "Aurora | aurora" readme.md solace-project-plan` | 通过，未发现当前 README 或项目计划中的旧名残留 |

## 后续动作

- 历史日志中说明命名迁移过程的旧名引用继续保留，避免破坏变更记录语境。
