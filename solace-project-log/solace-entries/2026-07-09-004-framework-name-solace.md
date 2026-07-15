# 2026-07-09-004：正式采用 Solace 作为框架名称

## 基本信息

- 日期：2026-07-09
- 类型：文档
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

将根目录 `readme.md` 中的框架名称从临时名 `Aurora` 调整为正式名称 `Solace`。同时在 README 中新增命名来源说明，解释名称与 TypeScript、开发者 `alone`、前端框架定位之间的关系。

## 变动原因

此前的临时命名不够正式，用户确认采用 `Solace` 作为框架名。README 需要明确名称、正式描述和命名来源，作为后续项目文档和实现计划的品牌基线。

## 影响范围

- 影响模块：项目品牌命名、README 项目说明、项目日志。
- 影响对象：后续文档、包命名、模块命名、执行计划同步。
- 行为变化：没有运行时代码变化；仅更新文档命名与说明。
- 风险等级：低，纯文档变更。

## 涉及文件

| 文件                                                                        | 动作 | 说明                                                                        |
| --------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------- |
| `readme.md`                                                                 | 修改 | 标题和项目目标改用 `Solace`，新增命名来源说明，并更新性能报告模板中的框架名 |
| `solace-project-log/index.md`                                               | 修改 | 追加第 004 条变更索引                                                       |
| `solace-project-log/solace-entries/2026-07-09-004-framework-name-solace.md` | 新增 | 记录本次框架命名变更                                                        |

## 验证记录

| 验证项          | 命令或方式                                                                                                                                                                                                                                           | 结果                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 框架名称检查    | `rg -n "Aurora                                                                                                                                                                                                                                       | Solace" readme.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-09-004-framework-name-solace.md` | 通过，README 和日志索引已出现 `Solace`；`Aurora` 仅作为旧临时名出现在本日志说明中 |
| 旧名称清理检查  | `rg -n "Aurora" readme.md`                                                                                                                                                                                                                           | 通过，`readme.md` 中没有旧临时名                                                                                         |
| README 章节检查 | `rg -n "框架命名                                                                                                                                                                                                                                     | 命名来源                                                                                                                 | TypeScript-first                                                                  | created by alone" readme.md` | 通过，命名说明章节存在 |
| 文档验证建议    | `node /Users/alone/.codex/skills/frontend-engineering/scripts/recommend-validation.mjs --root /Users/alone/Desktop/TEST/frontend-ts readme.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-09-004-framework-name-solace.md` | 通过，检测为文档变更，当前无项目级验证命令                                                                               |

## 后续动作

- 如需全项目命名一致，后续可同步更新 `solace-project-plan/` 中仍使用临时名 `Aurora` 的计划文本。
- 等阶段 0 创建 `package.json` 时，建议使用 `solace` 或作用域包名作为包名基线。
