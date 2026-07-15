# 2026-07-10-018：补强 release check 与 CI 门禁

## 基本信息

- 日期：2026-07-10
- 类型：脚本 / CI / 文档
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

新增 `pnpm release:check` 作为本地发布前完整门禁，并将 package consumer smoke、benchmark smoke 和浏览器 e2e 接入 GitHub Actions。README 和包使用文档同步记录发布前检查命令。

## 变动原因

项目已经具备 package smoke、benchmark 和 Playwright e2e，但 CI 只覆盖 typecheck、lint、build 和 Vitest，未覆盖发布前真实 tarball 消费路径，也未覆盖 README 中提到的 benchmark smoke。补强门禁后，本地和 CI 的发布前检查范围更一致。

## 影响范围

- 影响模块：package scripts、GitHub Actions、发布前文档。
- 影响对象：`release:check`、CI quality job、package consumer smoke、benchmark smoke、Chromium e2e。
- 行为变化：新增本地 `pnpm release:check` 命令；CI 在常规测试后额外运行 package smoke、benchmark 和 e2e。
- 风险等级：中；CI 耗时会增加，Playwright 浏览器安装依赖 GitHub runner 的网络和系统包安装能力。

## 涉及文件

| 文件                                                                        | 动作 | 说明                                                               |
| --------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `package.json`                                                              | 修改 | 增加 `release:check` 脚本                                          |
| `.github/workflows/ci.yml`                                                  | 修改 | 增加 package smoke、benchmark、Playwright Chromium 安装和 e2e 步骤 |
| `docs/package-usage.md`                                                     | 修改 | 记录完整本地 release gate                                          |
| `readme.md`                                                                 | 修改 | 在快速开始旁补充发布前完整检查命令                                 |
| `solace-project-log/solace-entries/2026-07-10-018-release-check-ci-gate.md` | 新增 | 记录本次 release check 和 CI 门禁变更                              |
| `solace-project-log/index.md`                                               | 修改 | 追加本次变更索引                                                   |

## 验证记录

| 验证项            | 命令或方式           | 结果                                                                    |
| ----------------- | -------------------- | ----------------------------------------------------------------------- |
| 本地 release gate | `pnpm release:check` | 通过，quality、package smoke、benchmark 和 3 个 Chromium e2e 测试均通过 |

## 后续动作

- 真正启用远端 CI 后，观察 Playwright 浏览器安装耗时，必要时拆分 e2e job 或增加缓存策略。
- 发布前如移除 `private: true`，应继续用 `pnpm release:check` 作为最后本地门禁。
