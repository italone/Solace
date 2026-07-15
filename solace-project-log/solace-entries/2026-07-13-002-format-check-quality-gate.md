# 2026-07-13-002：接入格式检查质量门禁

## 基本信息

- 日期：2026-07-13
- 类型：配置 / 构建 / 文档
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

新增 `format:check` 脚本，并将其接入 `quality` 和 GitHub Actions。运行 `pnpm format` 对仓库现有源码、测试、示例、文档、计划和日志执行统一 Prettier 格式化，并同步 release/package usage/README/examples/项目计划中对质量门禁的说明。

## 变动原因

前序文档调整暴露出格式漂移只能通过临时命令发现，未纳入常规质量门禁。将非破坏性的 Prettier 检查接入 `quality` 后，本地 `pnpm quality`、`pnpm release:check` 和 CI 都能提前发现格式问题。

## 影响范围

- 影响模块：package scripts、CI、文档、仓库格式化。
- 影响对象：`quality`、`release:check`、GitHub Actions、本地格式检查流程。
- 行为变化：`pnpm quality` 现在会先执行 `pnpm format:check`。
- 风险等级：中；涉及广泛机械格式化，但不改变运行时逻辑。

## 涉及文件

| 文件                       | 动作          | 说明                                                                                           |
| -------------------------- | ------------- | ---------------------------------------------------------------------------------------------- |
| `package.json`             | 修改          | 新增 `format:check`，并将其接入 `quality`                                                      |
| `.github/workflows/ci.yml` | 修改          | 在 CI 中增加 Format check 步骤                                                                 |
| `readme.md`                | 修改          | 同步 CI、发布门禁说明和推荐 scripts 示例                                                       |
| `docs/release.md`          | 修改          | 同步 release gate 说明                                                                         |
| `docs/package-usage.md`    | 修改          | 同步 release check 说明                                                                        |
| `docs/examples.md`         | 修改          | 同步 release check 中 quality/format check 说明                                                |
| `solace-project-plan/**`   | 修改 / 格式化 | 同步 format check 完成条件、阶段 0 quality 脚本示例、benchmark 命令和 package exports 验证命令 |
| `src/**`                   | 格式化        | 执行 `pnpm format` 产生的 Prettier 机械格式化                                                  |
| `tests/**`                 | 格式化        | 执行 `pnpm format` 产生的 Prettier 机械格式化                                                  |
| `examples/**`              | 格式化        | 执行 `pnpm format` 产生的 Prettier 机械格式化                                                  |
| `docs/**`                  | 格式化        | 执行 `pnpm format` 产生的 Prettier 机械格式化                                                  |
| `solace-project-log/**`    | 格式化 / 修改 | 格式化历史日志并追加本次日志                                                                   |
| `pnpm-lock.yaml`           | 格式化        | 执行 `pnpm format` 产生的 Prettier 机械格式化                                                  |

## 验证记录

| 验证项                        | 命令或方式                             | 结果                                                                                         |
| ----------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------- |
| 广泛格式检查基线              | `pnpm exec prettier --check .`         | 初次失败，发现 79 个文件存在格式漂移                                                         |
| 格式化                        | `pnpm format`                          | 通过，Prettier 完成仓库格式化                                                                |
| 格式检查                      | `pnpm format:check`                    | 通过，所有匹配文件符合 Prettier 风格                                                         |
| 质量门禁                      | `pnpm quality`                         | 通过，包含 format check、typecheck、JSX dev typecheck、lint、默认测试和 package exports 测试 |
| 文档脚本同步检查              | `rg` 扫描 README、examples 和项目计划  | 通过，`format:check`、`test:package`、`package:smoke` 和 `release:check` 说明可检索          |
| Plan quality script check     | `rg` 扫描阶段 0 质量与 CI 计划         | 通过，`typecheck:jsxdev` 和 `test:package` 已纳入计划中的 `quality` 示例                     |
| Benchmark script check        | `rg` 扫描阶段 0 构建测试工具计划       | 通过，benchmark 脚本引用当前 `vitest.benchmark.config.ts` 配置                               |
| Release plan command check    | `rg` 扫描阶段 6 benchmark/release 计划 | 通过，发布验证命令已使用当前 `pnpm release:check` 门禁                                       |
| Benchmark                     | `pnpm benchmark`                       | 通过，3 个测试文件、3 个测试通过                                                             |
| Package exports command check | `rg` 扫描阶段 5 包构建计划             | 通过，package exports 验证命令已使用 `pnpm test:package`                                     |
| Package exports tests         | `pnpm test:package`                    | 通过，构建成功，1 个测试文件、6 个测试通过                                                   |
| Package consumer smoke        | `pnpm package:smoke`                   | 最终复查通过，tarball 消费、公开类型导入、TSX typecheck、ESM/CJS 入口验证均通过              |
| Release gate                  | `pnpm release:check`                   | 最终复查通过，quality、coverage、package smoke、benchmark 和 Playwright e2e 均通过           |

## 后续动作

- 后续新增文件时应保持 `pnpm format:check` 通过，再运行发布前门禁。
