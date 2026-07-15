# 2026-07-15-002：新增 DevTools public subpath

## 基本信息

- 日期：2026-07-15
- 类型：包导出 / DevTools public API / 文档 / package smoke
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

新增 `solace/devtools` public subpath，暴露 DevTools listener、recorder 和相关类型。package root 继续不暴露
DevTools API，public subpath 也不暴露内部 emit、listener-state、clear 或 serializer helpers。

## 变动原因

DevTools internal recorder、payload stability smoke 和 public boundary guard 已完成。继续推进 DevTools 需要一个可验证的低层 public integration surface，同时保持 runtime internals 和隐私边界稳定。

## 影响范围

- 影响模块：package exports、Rollup 构建入口、DevTools public barrel、package consumer smoke、TypeScript self-reference resolution、DevTools 文档、README、项目日志。
- 行为变化：新增 `solace/devtools` 子路径；无 listener 时 runtime 仍保持 DevTools dormant。
- 风险等级：中；涉及 package export map、ESM/CJS/type 产物一致性和 public API 边界。

## 涉及文件

| 文件                                                                      | 动作 | 说明                                      |
| ------------------------------------------------------------------------- | ---- | ----------------------------------------- |
| `src/devtools/index.ts`                                                   | 新增 | DevTools public barrel                    |
| `package.json`                                                            | 修改 | 新增 `./devtools` package export          |
| `rollup.config.mjs`                                                       | 修改 | 新增 devtools JS/CJS/type 构建入口        |
| `tsconfig.json`                                                           | 修改 | 明确 rootDir 并添加 devtools source path  |
| `tests/integration/package-exports.test.ts`                               | 修改 | 验证 public subpath 和 private internals  |
| `scripts/package-consumer-smoke.mjs`                                      | 修改 | 验证 packed consumer 的 DevTools subpath  |
| `docs/devtools.md`                                                        | 修改 | 记录 public API lifecycle 和生产边界      |
| `docs/package-usage.md`                                                   | 修改 | 列出 `solace/devtools` public entry point |
| `readme.md`                                                               | 修改 | 更新 DevTools 当前状态和后续建议          |
| `docs/superpowers/specs/2026-07-15-devtools-public-api-design.md`         | 新增 | 记录设计                                  |
| `docs/superpowers/plans/2026-07-15-devtools-public-api.md`                | 新增 | 记录实施计划                              |
| `solace-project-log/index.md`                                             | 修改 | 追加 2026-07-15 日志索引                  |
| `solace-project-log/solace-entries/2026-07-15-002-devtools-public-api.md` | 新增 | 记录本次变更                              |

## 验证记录

| 验证项            | 命令或方式              | 结果                                |
| ----------------- | ----------------------- | ----------------------------------- |
| Package exports   | `pnpm test:package`     | 通过，1 个测试文件、7 个测试通过    |
| Package smoke     | `pnpm package:smoke`    | 通过，packed consumer smoke passed  |
| Tests             | `pnpm test`             | 通过，18 个测试文件、133 个测试通过 |
| Typecheck         | `pnpm typecheck`        | 通过，无类型错误                    |
| JSX dev typecheck | `pnpm typecheck:jsxdev` | 通过，无类型错误                    |
| Lint              | `pnpm lint`             | 通过，无 ESLint 错误                |
| Build             | `pnpm build`            | 通过，Rollup 产物构建成功           |
| 格式检查          | `pnpm format:check`     | 通过，所有匹配文件符合 Prettier     |

## 后续动作

- 后续 DevTools 扩展应继续通过 summary payload 暴露信息，避免输出 raw runtime objects、用户内容或敏感数据。
- 浏览器扩展或可视化面板应在更多真实示例验证后再实现。
