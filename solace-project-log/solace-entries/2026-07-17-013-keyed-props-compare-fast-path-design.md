# 2026-07-17-013：设计 keyed props compare fast path

## 基本信息

- 日期：2026-07-17
- 类型：renderer performance design / project log
- 状态：已完成
- 关联提交：本条日志随设计文档提交一并提交

## 变动摘要

新增 keyed props compare fast path 设计规格，限定下一轮 renderer/performance 优化为 `src/renderer/diff.ts` 内部 props comparison 的保守快速路径。

## 变动原因

最新 browser benchmark history 已刷新到 17 条 Chromium large-list 记录。继续推进 runtime 性能优化时，应选择有基准支撑且风险最窄的切片；稳定 keyed sibling 的 props comparison 是当前 large-list update 路径中比 Fragment 或 component batching 更小的切入点。

## 影响范围

- 影响模块：renderer performance 设计规格、项目日志。
- 影响对象：后续实现计划和 TDD 任务。
- 行为变化：无运行时代码变化。
- 风险等级：低；仅新增设计文档。

## 涉及文件

| 文件                                                                                       | 动作 | 说明                                    |
| ------------------------------------------------------------------------------------------ | ---- | --------------------------------------- |
| `docs/superpowers/specs/2026-07-17-keyed-props-compare-fast-path-design.md`                | 新增 | 记录 keyed props compare fast path 设计 |
| `solace-project-log/solace-entries/2026-07-17-013-keyed-props-compare-fast-path-design.md` | 新增 | 记录本次设计文档变更                    |
| `solace-project-log/index.md`                                                              | 修改 | 追加 2026-07-17 日志索引                |

## 验证记录

| 验证项           | 命令或方式          | 结果                   |
| ---------------- | ------------------- | ---------------------- |
| 格式检查         | `pnpm format:check` | 通过                   |
| Diff whitespace  | `git diff --check`  | 通过                   |
| Private boundary | `package.json`      | 保持 `"private": true` |

## 后续动作

- 下一步基于该设计写 implementation plan；实现阶段必须先写 renderer 单元测试并验证 RED，再改 `src/renderer/diff.ts`。
