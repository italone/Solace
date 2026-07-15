# 2026-07-14-004：将 browser benchmark 纳入 release gate

## 基本信息

- 日期：2026-07-14
- 类型：发布门禁 / 测试 / 文档
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

将 `pnpm benchmark:browser` 纳入 `release:check`，使发布前 gate 同时覆盖 jsdom Tinybench smoke、Chromium production browser benchmark 和普通 browser e2e。同步扩展 release readiness 检查，要求 `release:check` 包含 `pnpm benchmark:browser`。

## 变动原因

Solace 已具备 browser production benchmark 和 metadata 输出，但 release gate 尚未执行该路径。纳入 `release:check` 后，发布前检查和当前 benchmark 能力保持一致，减少发布前漏跑生产浏览器 benchmark 的风险。

## 影响范围

- 影响模块：package scripts、release readiness tooling、release 文档、README、项目日志。
- 行为变化：`pnpm release:check` 会在 jsdom benchmark 后、普通 e2e 前执行 `pnpm benchmark:browser`。
- 风险等级：中低；release gate 会变慢，并要求本地/CI 能运行 Playwright production preview benchmark。

## 涉及文件

| 文件                                                                                 | 动作 | 说明                                          |
| ------------------------------------------------------------------------------------ | ---- | --------------------------------------------- |
| `package.json`                                                                       | 修改 | `release:check` 增加 `pnpm benchmark:browser` |
| `scripts/release-readiness-check.mjs`                                                | 修改 | 校验 release gate 包含 browser benchmark      |
| `docs/release.md`                                                                    | 修改 | 对齐 release gate 描述                        |
| `readme.md`                                                                          | 修改 | 对齐发布门禁能力摘要                          |
| `docs/superpowers/specs/2026-07-14-release-browser-benchmark-gate-design.md`         | 新增 | 记录设计                                      |
| `docs/superpowers/plans/2026-07-14-release-browser-benchmark-gate.md`                | 新增 | 记录实施计划                                  |
| `solace-project-log/index.md`                                                        | 修改 | 追加本次日志索引                              |
| `solace-project-log/solace-entries/2026-07-14-004-release-browser-benchmark-gate.md` | 新增 | 记录本次变更                                  |

## 验证记录

| 验证项            | 命令或方式                                                                                                                        | 结果                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Readiness         | `pnpm release:readiness`                                                                                                          | 通过，release metadata 和 `release:check` browser benchmark 覆盖检查通过                                  |
| Browser benchmark | `pnpm benchmark:browser`                                                                                                          | 通过，提升权限允许本地 preview 监听端口后，1 个 Chromium benchmark 通过并输出 `browser benchmark summary` |
| Release check     | `pnpm release:check`                                                                                                              | 通过，完整 gate 已执行 quality、coverage、package smoke、jsdom benchmark、browser benchmark 和 e2e        |
| Typecheck         | `pnpm typecheck`                                                                                                                  | 通过，无类型错误                                                                                          |
| Lint              | `pnpm lint`                                                                                                                       | 通过，无 ESLint 错误                                                                                      |
| 格式检查          | `pnpm format:check`                                                                                                               | 通过，所有匹配文件符合 Prettier 风格                                                                      |
| Private state     | `node -e "const pkg = require('./package.json'); if (pkg.private !== true) process.exit(1); console.log('private remains true')"` | 通过，`package.json` 仍保持 `"private": true`                                                             |

## 后续动作

- 如果 CI runtime 过慢，可后续评估是否拆分 release gate 与 nightly benchmark gate；本次保持发布前 gate 覆盖最完整。
