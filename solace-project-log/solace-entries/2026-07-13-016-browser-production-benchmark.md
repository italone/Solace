# 2026-07-13-016：新增浏览器生产构建性能基准

## 基本信息

- 日期：2026-07-13
- 类型：测试 / 示例 / 文档 / 工具
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

新增 `examples/performance-benchmark` 生产构建 benchmark 示例和独立 Playwright benchmark 配置。`pnpm benchmark:browser` 会构建示例、通过 Vite preview 启动生产输出，并在 Chromium 中测量 10,000 行列表的初始渲染、响应式更新和卸载耗时。

## 变动原因

现有 `pnpm benchmark` 基于 jsdom 和 tinybench，不能代表真实浏览器生产构建表现。性能文档和 README 都将浏览器生产构建 benchmark 数据列为后续方向，本次建立可重复运行的 harness，但不设置绝对性能阈值。

## 影响范围

- 影响模块：Vite 示例、Playwright benchmark、package scripts、lint/build output ignore、性能文档、README、项目日志。
- 行为变化：新增 `pnpm benchmark:browser` 命令，不影响现有 `pnpm test:e2e`。
- 风险等级：中；新增生产 build/preview 测试路径，但不修改 runtime 源码。

## 涉及文件

| 文件                                                                               | 动作 | 说明                               |
| ---------------------------------------------------------------------------------- | ---- | ---------------------------------- |
| `examples/performance-benchmark/index.html`                                        | 新增 | 浏览器 benchmark HTML shell        |
| `examples/performance-benchmark/src/main.tsx`                                      | 新增 | 浏览器 benchmark app 和 window API |
| `examples/performance-benchmark/vite.config.ts`                                    | 新增 | benchmark 示例 Vite alias 配置     |
| `playwright.benchmark.config.ts`                                                   | 新增 | 独立 Playwright benchmark 配置     |
| `tests/e2e/browser-benchmark.spec.ts`                                              | 新增 | Chromium benchmark spec            |
| `package.json`                                                                     | 修改 | 新增 benchmark browser scripts     |
| `.gitignore`                                                                       | 修改 | 忽略 examples 下的 Vite dist 输出  |
| `eslint.config.js`                                                                 | 修改 | lint 忽略 examples 下的 dist 输出  |
| `docs/performance.md`                                                              | 修改 | 记录浏览器生产构建 benchmark       |
| `readme.md`                                                                        | 修改 | 更新后续性能建议                   |
| `docs/superpowers/specs/2026-07-13-browser-production-benchmark-design.md`         | 新增 | 记录设计                           |
| `docs/superpowers/plans/2026-07-13-browser-production-benchmark.md`                | 新增 | 记录实施计划                       |
| `solace-project-log/index.md`                                                      | 修改 | 追加本次日志索引                   |
| `solace-project-log/solace-entries/2026-07-13-016-browser-production-benchmark.md` | 新增 | 记录本次变更                       |

## 验证记录

| 验证项            | 命令或方式               | 结果                                                                    |
| ----------------- | ------------------------ | ----------------------------------------------------------------------- |
| Browser benchmark | `pnpm benchmark:browser` | 通过，Chromium benchmark 1 个测试通过并输出 `browser benchmark summary` |
| Typecheck         | `pnpm typecheck`         | 通过，无类型错误                                                        |
| Lint              | `pnpm lint`              | 通过，无 ESLint 错误                                                    |
| 格式检查          | `pnpm format:check`      | 通过，所有匹配文件符合 Prettier 风格                                    |

## 后续动作

- 后续可记录更多机器和浏览器元数据，或在稳定后评估是否纳入 release gate。
