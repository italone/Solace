# 2026-07-20-015：编写 browser keyed reorder benchmark 实现计划

## 基本信息

- 日期：2026-07-20
- 类型：browser benchmark planning / project log
- 状态：已完成

## 变动摘要

补写 browser keyed reorder benchmark 的 implementation plan，明确下一阶段将把 Chromium browser benchmark 扩展为
`large-list` + `keyed-reorder` 两个场景，并同步更新 browser history summary 的 `reorderMs` 聚合路径。

## 变动原因

发布第一版后，性能工作继续沿当前计划推进。设计稿已经完成，下一步需要把实现任务拆成可执行步骤，再进入代码改动。

## 影响范围

- 影响模块：项目计划、项目日志。
- 行为变化：无运行时代码变化；本次仅新增计划文档与日志。
- 风险等级：低；不改动 benchmark fixture、summary CLI 或 renderer 代码。

## 涉及文件

| 文件                                                                                       | 动作 | 说明                        |
| ------------------------------------------------------------------------------------------ | ---- | --------------------------- |
| `docs/superpowers/plans/2026-07-20-browser-keyed-reorder-benchmark.md`                     | 新增 | 记录 keyed reorder 实现计划 |
| `solace-project-log/solace-entries/2026-07-20-015-browser-keyed-reorder-benchmark-plan.md` | 新增 | 记录本次计划变更            |
| `solace-project-log/index.md`                                                              | 修改 | 追加 2026-07-20 日志索引    |

## 验证记录

| 验证项          | 命令或方式                                                                                                                                                                                                             | 结果 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 格式检查        | `pnpm exec prettier --write docs/superpowers/plans/2026-07-20-browser-keyed-reorder-benchmark.md solace-project-log/solace-entries/2026-07-20-015-browser-keyed-reorder-benchmark-plan.md solace-project-log/index.md` | 通过 |
| 格式校验        | `pnpm format:check`                                                                                                                                                                                                    | 通过 |
| Diff whitespace | `git diff --check`                                                                                                                                                                                                     | 通过 |

## 后续动作

- 按计划进入 implementation 阶段：先补 browser history 类型和 summary 测试，再扩展 benchmark fixture 与 Playwright
  用例，最后刷新文档与本地 trend 记录。
