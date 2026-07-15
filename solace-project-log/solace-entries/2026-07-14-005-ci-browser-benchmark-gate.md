# 2026-07-14-005：CI 纳入 browser benchmark

## 基本信息

- 日期：2026-07-14
- 类型：CI / 测试 / 文档
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

在 GitHub Actions CI 中新增 `Browser benchmark` step，使 CI 在安装 Playwright Chromium 后运行 `pnpm benchmark:browser`，再执行普通 `pnpm test:e2e`。同步 release 文档，说明 CI 和本地 release gate 都覆盖 jsdom benchmark 与 Chromium production browser benchmark。

## 变动原因

本地 `pnpm release:check` 已纳入 `pnpm benchmark:browser`，但 CI 仍只运行 jsdom benchmark 和普通 e2e。补齐 CI step 后，本地发布门禁和 CI 覆盖范围保持一致。

## 影响范围

- 影响模块：GitHub Actions CI、release 文档、项目日志。
- 行为变化：CI 会额外执行 `pnpm benchmark:browser`。
- 风险等级：低；CI 运行时间增加，但 Playwright Chromium 依赖已由现有 install step 提供。

## 涉及文件

| 文件                                                                            | 动作 | 说明                             |
| ------------------------------------------------------------------------------- | ---- | -------------------------------- |
| `.github/workflows/ci.yml`                                                      | 修改 | 新增 `Browser benchmark` step    |
| `docs/release.md`                                                               | 修改 | 记录 CI 也运行 browser benchmark |
| `docs/superpowers/specs/2026-07-14-ci-browser-benchmark-gate-design.md`         | 新增 | 记录设计                         |
| `docs/superpowers/plans/2026-07-14-ci-browser-benchmark-gate.md`                | 新增 | 记录实施计划                     |
| `solace-project-log/index.md`                                                   | 修改 | 追加本次日志索引                 |
| `solace-project-log/solace-entries/2026-07-14-005-ci-browser-benchmark-gate.md` | 新增 | 记录本次变更                     |

## 验证记录

| 验证项            | 命令或方式               | 结果                                                                                                      |
| ----------------- | ------------------------ | --------------------------------------------------------------------------------------------------------- |
| Browser benchmark | `pnpm benchmark:browser` | 通过，提升权限允许本地 preview 监听端口后，1 个 Chromium benchmark 通过并输出 `browser benchmark summary` |
| Lint              | `pnpm lint`              | 通过，无 ESLint 错误                                                                                      |
| Build             | `pnpm build`             | 通过，Rollup 产物构建成功                                                                                 |
| 格式检查          | `pnpm format:check`      | 通过，所有匹配文件符合 Prettier 风格                                                                      |

## 后续动作

- 后续如果 CI 时间过长，可再评估是否把 browser benchmark 拆到独立 job 或 nightly workflow。
