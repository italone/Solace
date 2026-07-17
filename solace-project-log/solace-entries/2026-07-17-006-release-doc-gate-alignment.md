# 2026-07-17-006：同步 release gate 文档说明

## 基本信息

- 日期：2026-07-17
- 类型：release docs / README / examples docs / package usage docs / project log
- 状态：已完成
- 关联提交：本条日志随文档更新提交一并提交

## 变动摘要

同步 release gate 文档说明：README 推荐脚本中的 `benchmark` 和 `release:check` 与当前 `package.json` 对齐，并在 package usage 与 examples 文档中明确 `release:check` 包含 jsdom benchmark、Chromium production browser benchmark 和 browser e2e。

## 变动原因

`pnpm release:check` 全量门禁已经本地通过，但 README 中的旧推荐脚本仍未列出 `benchmark:browser`。本次只修正文档漂移，让发布前门禁说明与实际脚本保持一致。

## 影响范围

- 影响模块：README、package usage 文档、examples 文档、项目日志。
- 行为变化：无运行时代码变化。
- 风险等级：低；仅更新文档说明。

## 涉及文件

| 文件                                                                             | 动作 | 说明                                 |
| -------------------------------------------------------------------------------- | ---- | ------------------------------------ |
| `readme.md`                                                                      | 修改 | 对齐推荐脚本和后续建议               |
| `docs/package-usage.md`                                                          | 修改 | 对齐 full release gate 覆盖范围      |
| `docs/examples.md`                                                               | 修改 | 对齐 release check 中的 e2e 前置门禁 |
| `solace-project-log/solace-entries/2026-07-17-006-release-doc-gate-alignment.md` | 新增 | 记录本次文档同步                     |
| `solace-project-log/index.md`                                                    | 修改 | 追加 2026-07-17 日志索引             |

## 验证记录

| 验证项           | 命令或方式          | 结果                   |
| ---------------- | ------------------- | ---------------------- |
| 格式检查         | `pnpm format:check` | 通过                   |
| Diff whitespace  | `git diff --check`  | 通过                   |
| Private boundary | `package.json`      | 保持 `"private": true` |

## 后续动作

- 当前文档已与 full release gate 对齐；在用户明确批准前继续保持 private，不执行 version 或 publish。
