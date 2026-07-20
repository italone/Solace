# 2026-07-20-010：设计 initial class mount fast path

## 基本信息

- 日期：2026-07-20
- 类型：performance design / renderer mount / project log
- 状态：已完成
- 关联提交：本条日志随设计文档提交一并提交

## 变动摘要

新增 initial class mount fast path 设计规格，限定下一轮性能优化为 element initial mount 上的 `class`
快速路径，减少 large-list 初始渲染中每个元素 class 写入的通用 attribute 开销。

## 变动原因

initial props mount fast path 已经消掉普通属性的多余扫描，但 browser 和 component initial render 仍会对
`class` 进行大量写入。这个 prop 在当前 benchmark fixtures 中非常集中，适合单独做一个更窄的 runtime 切片。

## 影响范围

- 影响模块：renderer mount 设计、browser initial render 后续计划、项目日志。
- 行为变化：无运行时代码变化；本次只新增设计文档。
- 风险等级：低；设计限定后续实现不得改变 update props patching、event props、scheduler、DevTools payload 或 public API。

## 涉及文件

| 文件                                                                                       | 动作 | 说明                                    |
| ------------------------------------------------------------------------------------------ | ---- | --------------------------------------- |
| `docs/superpowers/specs/2026-07-20-initial-class-mount-fast-path-design.md`                | 新增 | 记录 initial class mount fast path 设计 |
| `solace-project-log/solace-entries/2026-07-20-010-initial-class-mount-fast-path-design.md` | 新增 | 记录本次设计变更                        |
| `solace-project-log/index.md`                                                              | 修改 | 追加 2026-07-20 日志索引                |

## 验证记录

| 验证项           | 命令或方式          | 结果                   |
| ---------------- | ------------------- | ---------------------- |
| Placeholder scan | 检查设计稿占位符    | 通过                   |
| 格式检查         | `pnpm format:check` | 通过                   |
| Diff whitespace  | `git diff --check`  | 通过                   |
| Private boundary | `package.json`      | 保持 `"private": true` |

## 后续动作

- 进入 implementation plan：用 TDD 覆盖 initial class mount 的 HTML className fast path，再实现 renderer 内部改动。
