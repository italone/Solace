# 2026-07-15-005：收紧 DevTools 生产构建边界

## 基本信息

- 日期：2026-07-15
- 类型：package artifacts / Rollup sourcemaps / DevTools 文档
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

新增 package exports 集成测试，验证 `pnpm build` 后的 `dist` 不包含 JavaScript sourcemap。同步关闭 Rollup
JavaScript 与自定义 TypeScript transform 的 sourcemap 输出，并在 DevTools 文档中记录生产包不发布 sourcemap
的边界。

## 变动原因

`solace/devtools` public subpath 已经只暴露 listener 和 recorder API，但生产包的 sourcemap 会携带内部
DevTools 源码和 helper 名。关闭发布产物 sourcemap 可以避免消费者依赖内部 helper 名或模块布局，同时不改变
runtime API。

## 影响范围

- 影响模块：Rollup package build、package exports 集成测试、DevTools 文档、项目日志。
- 行为变化：`pnpm build` 不再生成 `dist/*.map`；package public API 与 runtime 行为不变。
- 风险等级：中低；调试发布包时不再有 sourcemap，但减少了生产发布产物暴露面。

## 涉及文件

| 文件                                                                               | 动作 | 说明                            |
| ---------------------------------------------------------------------------------- | ---- | ------------------------------- |
| `rollup.config.mjs`                                                                | 修改 | 关闭 JS/CJS 生产 sourcemap 输出 |
| `tests/integration/package-exports.test.ts`                                        | 修改 | 新增生产 sourcemap 边界测试     |
| `docs/devtools.md`                                                                 | 修改 | 记录生产构建边界                |
| `docs/superpowers/specs/2026-07-15-devtools-production-boundary-design.md`         | 新增 | 记录设计                        |
| `docs/superpowers/plans/2026-07-15-devtools-production-boundary.md`                | 新增 | 记录实施计划                    |
| `solace-project-log/index.md`                                                      | 修改 | 追加 2026-07-15 日志索引        |
| `solace-project-log/solace-entries/2026-07-15-005-devtools-production-boundary.md` | 新增 | 记录本次变更                    |

## 验证记录

| 验证项        | 命令或方式              | 结果                                                       |
| ------------- | ----------------------- | ---------------------------------------------------------- |
| TDD RED       | `pnpm test:package`     | 按预期失败，测试列出 12 个当前构建生成的 `dist/*.map` 文件 |
| Package tests | `pnpm test:package`     | 通过，1 个测试文件、8 个测试通过                           |
| Build         | `pnpm build`            | 通过，未生成 `dist/*.map`                                  |
| Typecheck     | `pnpm typecheck`        | 通过                                                       |
| JSX typecheck | `pnpm typecheck:jsxdev` | 通过                                                       |
| Lint          | `pnpm lint`             | 通过                                                       |
| Tests         | `pnpm test`             | 通过，18 个测试文件、138 个测试通过                        |
| Package smoke | `pnpm package:smoke`    | 通过，tarball 内容不包含 `.map` 文件                       |
| 格式检查      | `pnpm format:check`     | 通过                                                       |

## 后续动作

- 后续如果需要发布 sourcemap，应先明确 source map policy，并为 DevTools internal helper 暴露面重新评估边界。
- 继续保持 `solace/devtools` public subpath 只暴露 listener、recorder 和事件类型。
