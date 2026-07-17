# 2026-07-17-018：设计 jsdom benchmark metrics history

## 基本信息

- 日期：2026-07-17
- 类型：benchmark tooling design / performance docs / project log
- 状态：已完成
- 关联提交：本条日志随设计文档提交一并提交

## 变动摘要

新增 jsdom benchmark metrics history 设计规格，限定下一轮工具链工作为持久化 Tinybench task-level metrics，并让 `pnpm benchmark:history` 能汇总 jsdom task median、p95 和 variance。

## 变动原因

当前 browser benchmark history 已能汇总 timing metrics，但 jsdom history 只记录 metadata/status。继续推进性能优化前，需要让 jsdom benchmark 也能提供可追踪的 task-level 趋势数据，避免后续 runtime 优化缺少场景级证据。

## 影响范围

- 影响模块：benchmark tooling 设计规格、项目日志。
- 行为变化：无运行时代码变化。
- 风险等级：低；仅新增设计文档。

## 涉及文件

| 文件                                                                                         | 动作 | 说明                                      |
| -------------------------------------------------------------------------------------------- | ---- | ----------------------------------------- |
| `docs/superpowers/specs/2026-07-17-jsdom-benchmark-metrics-history-design.md`                | 新增 | 记录 jsdom benchmark metrics history 设计 |
| `solace-project-log/solace-entries/2026-07-17-018-jsdom-benchmark-metrics-history-design.md` | 新增 | 记录本次设计文档变更                      |
| `solace-project-log/index.md`                                                                | 修改 | 追加 2026-07-17 日志索引                  |

## 验证记录

| 验证项           | 命令或方式          | 结果                   |
| ---------------- | ------------------- | ---------------------- |
| 格式检查         | `pnpm format:check` | 通过                   |
| Diff whitespace  | `git diff --check`  | 通过                   |
| Private boundary | `package.json`      | 保持 `"private": true` |

## 后续动作

- 下一步基于该设计写 implementation plan；实现阶段必须先写脚本单元测试并验证 RED，再改 benchmark runner/history summarizer。
