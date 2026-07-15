# 2026-07-10-015：建立性能基准与 alpha 发布流程

## 基本信息

- 日期：2026-07-10
- 类型：测试 / 文档 / 发布流程
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

为 Solace 增加 tinybench 性能 smoke 基准、独立 benchmark Vitest 配置和初始 alpha changeset。性能文档现在记录本地运行环境、命令、结果表和结论，并明确当前结果只作为可复现 smoke benchmark，不作为性能领先声明。

## 变动原因

阶段 6 Step 02 需要用可重复命令验证性能相关场景，并为首个 alpha 版本准备发布记录。当前实现先建立基准框架和数据记录方式，为后续真实浏览器生产 benchmark 和优化提供基线。

## 影响范围

- 影响模块：performance tests、benchmark script、performance docs、changeset release note。
- 影响对象：1,000 组件首次渲染、10,000 行列表创建/更新/删除/重排、组件反复挂载/卸载观察。
- 行为变化：`pnpm benchmark` 现在运行 `tests/performance/**/*.bench.ts`，与常规 `pnpm test` 分离。
- 风险等级：低；运行时核心未改动，主要是测试和发布流程。

## 涉及文件

| 文件                                                                               | 动作 | 说明                                                       |
| ---------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------- |
| `tests/performance/render.bench.ts`                                                | 新增 | 1,000 组件首次渲染 benchmark                               |
| `tests/performance/list-diff.bench.ts`                                             | 新增 | 10,000 行列表创建、局部更新、删除、keyed reorder benchmark |
| `tests/performance/memory.bench.ts`                                                | 新增 | 组件反复挂载/卸载和 heap delta 观察 benchmark              |
| `vitest.benchmark.config.ts`                                                       | 新增 | 独立 benchmark Vitest 配置，避免常规测试默认运行性能基准   |
| `package.json`                                                                     | 修改 | 增加 `tinybench`，更新 `benchmark` 脚本                    |
| `pnpm-lock.yaml`                                                                   | 修改 | 锁定新增依赖                                               |
| `docs/performance.md`                                                              | 修改 | 写入环境、命令、结果表、结论和优化方向                     |
| `.changeset/initial-alpha.md`                                                      | 新增 | 初始 alpha 发布记录                                        |
| `solace-project-plan/solace-phase-06-quality-release/step-02-benchmark-release.md` | 修改 | 标记 Step 02 执行清单完成                                  |
| `solace-project-log/solace-entries/2026-07-10-015-benchmark-release.md`            | 新增 | 记录本次 benchmark 和发布流程变更                          |
| `solace-project-log/index.md`                                                      | 修改 | 追加本次变更索引                                           |

## 验证记录

| 验证项         | 命令或方式       | 结果                                     |
| -------------- | ---------------- | ---------------------------------------- |
| benchmark 命令 | `pnpm benchmark` | 通过，3 个 benchmark 文件、3 个测试      |
| 全量质量门禁   | `pnpm quality`   | 通过，14 个测试文件、66 个测试，构建通过 |
| 构建           | `pnpm build`     | 已由 `pnpm quality` 覆盖并通过           |

## 后续动作

- 后续发布前可引入真实 pack/install consumer smoke test。
- 后续性能优化应补充浏览器生产构建 benchmark，并记录机器硬件信息、样本量、median、p95 和方差。
