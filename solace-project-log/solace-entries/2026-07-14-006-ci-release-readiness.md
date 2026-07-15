# 2026-07-14-006：CI 纳入 release readiness

## 基本信息

- 日期：2026-07-14
- 类型：CI / 发布门禁 / 文档
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

在 GitHub Actions CI 中新增 `Release readiness` step，使 CI 在安装依赖后立即运行 `pnpm release:readiness`。同步 release 文档，说明 CI 会先检查 package metadata 和 release scripts，再执行更长的质量、测试和 benchmark 检查。

## 变动原因

`pnpm release:readiness` 已用于本地发布准备检查，但 CI 尚未执行该命令。将它放在 CI 前段可以更早发现 package metadata、Changesets access、release scripts 或 release gate 覆盖范围的漂移。

## 影响范围

- 影响模块：GitHub Actions CI、release 文档、项目日志。
- 行为变化：CI 会在 format/typecheck/lint/build/test 之前执行 `pnpm release:readiness`。
- 风险等级：低；该命令只读，不发布，不改变 `"private": true`。

## 涉及文件

| 文件                                                                       | 动作 | 说明                             |
| -------------------------------------------------------------------------- | ---- | -------------------------------- |
| `.github/workflows/ci.yml`                                                 | 修改 | 新增 `Release readiness` step    |
| `docs/release.md`                                                          | 修改 | 记录 CI 也运行 release readiness |
| `docs/superpowers/specs/2026-07-14-ci-release-readiness-design.md`         | 新增 | 记录设计                         |
| `docs/superpowers/plans/2026-07-14-ci-release-readiness.md`                | 新增 | 记录实施计划                     |
| `solace-project-log/index.md`                                              | 修改 | 追加本次日志索引                 |
| `solace-project-log/solace-entries/2026-07-14-006-ci-release-readiness.md` | 新增 | 记录本次变更                     |

## 验证记录

| 验证项    | 命令或方式               | 结果                                                       |
| --------- | ------------------------ | ---------------------------------------------------------- |
| Readiness | `pnpm release:readiness` | 通过，release metadata 检查通过并提示 package 仍为 private |
| Lint      | `pnpm lint`              | 通过，无 ESLint 错误                                       |
| Build     | `pnpm build`             | 通过，Rollup 产物构建成功                                  |
| 格式检查  | `pnpm format:check`      | 通过，所有匹配文件符合 Prettier 风格                       |

## 后续动作

- 后续如增加更多 release metadata 约束，应同步扩展 `scripts/release-readiness-check.mjs`，CI 会自动覆盖。
