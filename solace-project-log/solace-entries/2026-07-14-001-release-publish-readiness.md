# 2026-07-14-001：新增发布准备检查

## 基本信息

- 日期：2026-07-14
- 类型：工具 / 文档
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

新增本地 release readiness 检查，用于验证 package metadata、package entry points、release scripts 和 Changesets public access 配置。默认模式保留当前 `"private": true` 策略并提示包尚不可发布；`--publishable` 模式会在当前 private 状态下失败，避免误发布。

## 变动原因

Solace 已有 Changesets 和 release gate，但发布策略仍停留在文档说明。新增只读 readiness 检查可以在不联系 npm、不发布、不移除 `private` 的前提下，把发布前决策和本地元数据检查固定下来。

## 影响范围

- 影响模块：release tooling、package scripts、release/package 文档、README、项目日志。
- 行为变化：新增 `pnpm release:readiness`，不改变 `release:publish` 行为。
- 风险等级：低；新增只读脚本和文档，不修改 runtime 或发布私有状态。

## 涉及文件

| 文件                                                                            | 动作 | 说明                                    |
| ------------------------------------------------------------------------------- | ---- | --------------------------------------- |
| `scripts/release-readiness-check.mjs`                                           | 新增 | 本地发布准备检查脚本                    |
| `package.json`                                                                  | 修改 | 新增 `release:readiness` script         |
| `docs/release.md`                                                               | 修改 | 记录 readiness 命令和 publish checklist |
| `docs/package-usage.md`                                                         | 修改 | 增加 release readiness 指引             |
| `readme.md`                                                                     | 修改 | 更新后续发布建议                        |
| `docs/superpowers/specs/2026-07-14-release-publish-readiness-design.md`         | 新增 | 记录设计                                |
| `docs/superpowers/plans/2026-07-14-release-publish-readiness.md`                | 新增 | 记录实施计划                            |
| `solace-project-log/index.md`                                                   | 修改 | 追加本次日志索引                        |
| `solace-project-log/solace-entries/2026-07-14-001-release-publish-readiness.md` | 新增 | 记录本次变更                            |

## 验证记录

| 验证项                | 命令或方式                                | 结果                                                   |
| --------------------- | ----------------------------------------- | ------------------------------------------------------ |
| Readiness default     | `pnpm release:readiness`                  | 通过，默认模式通过并提示当前 package 仍为 private      |
| Readiness publishable | `pnpm release:readiness -- --publishable` | 预期失败，当前 `"private": true` 阻止 publishable 模式 |
| Typecheck             | `pnpm typecheck`                          | 通过，无类型错误                                       |
| Lint                  | `pnpm lint`                               | 通过，无 ESLint 错误                                   |
| Tests                 | `pnpm test`                               | 通过，14 个测试文件、114 个测试通过                    |
| 格式检查              | `pnpm format:check`                       | 通过，所有匹配文件符合 Prettier 风格                   |

## 后续动作

- 真正发布前仍需人工确认 npm 包名、访问权限、Changesets version 和是否移除或调整 `"private": true`。
