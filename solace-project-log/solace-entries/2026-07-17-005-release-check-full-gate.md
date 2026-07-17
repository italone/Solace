# 2026-07-17-005：记录 release check 全量门禁

## 基本信息

- 日期：2026-07-17
- 类型：release check / coverage / package smoke / benchmark / e2e / project log
- 状态：已完成
- 关联提交：本条日志随记录提交一并提交

## 变动摘要

执行 `pnpm release:check` 全量本地发布门禁。首次在沙箱内运行时，命令已通过 quality、coverage、package smoke 和
jsdom benchmark，但在 `benchmark:browser` 阶段因 Vite preview 无法监听 `127.0.0.1:5177` 返回 `EPERM`。提升权限后重跑完整命令并通过。

## 变动原因

上一轮已经记录 release readiness 与 quality 基线。本次继续执行更重的发布前全量门禁，覆盖 coverage thresholds、package consumer smoke、jsdom benchmark、Chromium production browser benchmark 和 browser e2e。

## 影响范围

- 影响模块：release check 记录、项目日志。
- 行为变化：无运行时代码变化。
- 风险等级：低；仅记录本地验证结果。

## 涉及文件

| 文件                                                                          | 动作 | 说明                     |
| ----------------------------------------------------------------------------- | ---- | ------------------------ |
| `solace-project-log/solace-entries/2026-07-17-005-release-check-full-gate.md` | 新增 | 记录本次全量门禁基线     |
| `solace-project-log/index.md`                                                 | 修改 | 追加 2026-07-17 日志索引 |

## 验证记录

| 验证项                 | 命令或方式               | 结果                                                                   |
| ---------------------- | ------------------------ | ---------------------------------------------------------------------- |
| Release check sandbox  | `pnpm release:check`     | 沙箱内运行至 `benchmark:browser` 后失败，Vite preview 监听端口 EPERM   |
| Release check full run | `pnpm release:check`     | 提升权限后通过                                                         |
| Quality gate           | `pnpm quality`           | 由 `release:check` 执行并通过                                          |
| Coverage               | `pnpm test:coverage`     | 通过；statements 96.68%、branches 90.4%、functions 98.88%、lines 96.6% |
| Package smoke          | `pnpm package:smoke`     | 通过；packed consumer smoke passed                                     |
| jsdom benchmark        | `pnpm benchmark`         | 通过；5 个 benchmark 测试通过                                          |
| Browser benchmark      | `pnpm benchmark:browser` | 通过；Chromium large-list benchmark 1 个测试通过                       |
| Browser e2e            | `pnpm test:e2e`          | 通过；basic counter、large-list、todo app 共 3 个测试通过              |
| Private boundary       | `package.json`           | 保持 `"private": true`                                                 |
| 格式检查               | `pnpm format:check`      | 通过                                                                   |
| Diff whitespace        | `git diff --check`       | 通过                                                                   |

## 后续动作

- 当前本地发布前门禁已经具备 readiness、quality 和 full release check 记录。
- 在用户明确批准前继续保持 `private: true`，不执行 `release:version` 或 `release:publish`。
