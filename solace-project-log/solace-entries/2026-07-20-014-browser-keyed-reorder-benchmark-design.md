# 2026-07-20-014：设计 browser keyed reorder benchmark

## 基本信息

- 日期：2026-07-20
- 类型：browser benchmark design / performance planning / project log
- 状态：已完成

## 变动摘要

新增 browser keyed reorder benchmark 设计规格，限定下一轮性能工作先扩展 Chromium production benchmark
覆盖 10,000-row keyed reorder，并让 browser history summary 聚合 `reorderMs`。

## 变动原因

发布后 browser benchmark 趋势已刷新。当前 browser fixture 只覆盖 initial render、单行 update 和 unmount；
而 jsdom 数据显示 `10000 row keyed reorder` 是最大热点。进入 runtime 优化前，需要先补真实浏览器侧信号。

## 影响范围

- 影响模块：browser benchmark 设计、benchmark history summary 设计、项目日志。
- 行为变化：无运行时代码变化；本次只新增设计文档。
- 风险等级：低；后续实现不得改变 renderer diff、public API、package exports 或 release threshold 策略。

## 涉及文件

| 文件                                                                                         | 动作 | 说明                            |
| -------------------------------------------------------------------------------------------- | ---- | ------------------------------- |
| `docs/superpowers/specs/2026-07-20-browser-keyed-reorder-benchmark-design.md`                | 新增 | 记录 browser keyed reorder 设计 |
| `solace-project-log/solace-entries/2026-07-20-014-browser-keyed-reorder-benchmark-design.md` | 新增 | 记录本次设计变更                |
| `solace-project-log/index.md`                                                                | 修改 | 追加 2026-07-20 日志索引        |

## 验证记录

| 验证项           | 命令或方式          | 结果 |
| ---------------- | ------------------- | ---- |
| Placeholder scan | 检查设计稿占位符    | 通过 |
| 格式检查         | `pnpm format:check` | 通过 |
| Diff whitespace  | `git diff --check`  | 通过 |

## 后续动作

- 用户确认设计后，进入 implementation plan：更新 browser benchmark fixture、Playwright assertions、
  browser history result types、history summary `reorderMs` 聚合、性能文档和实现日志。
