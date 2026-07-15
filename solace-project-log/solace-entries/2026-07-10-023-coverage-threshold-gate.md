# 2026-07-10-023：接入覆盖率阈值门禁

## 基本信息

- 日期：2026-07-10
- 类型：测试配置 / CI / 发布门禁
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

在 Vitest 主配置中增加覆盖率阈值，并将 `pnpm test:coverage` 接入本地 `release:check` 和 GitHub Actions。README 与 release 文档同步说明发布门禁现在包含 coverage thresholds。

## 变动原因

README 已将核心模块语句覆盖率 90%+ 作为目标，但此前覆盖率命令没有阈值约束，也未纳入发布前门禁。接入阈值后，覆盖率目标可以通过脚本持续验证。

## 影响范围

- 影响模块：Vitest coverage、package scripts、CI、release docs。
- 影响对象：`pnpm test:coverage`、`pnpm release:check`、GitHub Actions quality job。
- 行为变化：覆盖率低于阈值时 `pnpm test:coverage` 和发布门禁会失败。
- 风险等级：中；后续新增低覆盖代码会被门禁拦截，需要同步补测试或调整目标。

## 涉及文件

| 文件                                                                          | 动作 | 说明                                         |
| ----------------------------------------------------------------------------- | ---- | -------------------------------------------- |
| `vitest.config.ts`                                                            | 修改 | 增加 v8 coverage provider 和全局阈值         |
| `package.json`                                                                | 修改 | 将 `pnpm test:coverage` 接入 `release:check` |
| `.github/workflows/ci.yml`                                                    | 修改 | 增加 Coverage 步骤                           |
| `docs/release.md`                                                             | 修改 | 说明 release gate 包含覆盖率阈值             |
| `readme.md`                                                                   | 修改 | 当前能力中补充 coverage thresholds           |
| `solace-project-log/solace-entries/2026-07-10-023-coverage-threshold-gate.md` | 新增 | 记录本次覆盖率门禁变更                       |
| `solace-project-log/index.md`                                                 | 修改 | 追加本次变更索引                             |

## 验证记录

| 验证项         | 命令或方式           | 结果                                                                              |
| -------------- | -------------------- | --------------------------------------------------------------------------------- |
| 覆盖率门禁     | `pnpm test:coverage` | 通过，statements 92.16%、branches 80.28%、functions 72.09%、lines 91.26%          |
| 完整发布前门禁 | `pnpm release:check` | 通过，quality、coverage、package smoke、benchmark 和 3 个 Chromium e2e 测试均通过 |

## 后续动作

- 后续如果提升函数或分支覆盖率目标，应先补足低覆盖模块测试，再调整阈值。
