# 2026-07-10-026：收紧 package root API 暴露面

## 基本信息

- 日期：2026-07-10
- 类型：源码 / 测试 / 文档 / package API
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

收紧 `solace` package root 的运行时导出，只保留面向用户文档承诺的公共 API。`queueJob`、`ShapeFlags`、`createVNode`、`createComponentInstance`、`setupComponent` 等内部实现 helper 不再从根入口导出。内部单元测试改为从内部模块路径导入对应 helper，package exports 集成测试增加负向断言，防止内部 API 再次泄漏到发布入口。

## 变动原因

发布前需要保持根入口 API 克制，避免内部 scheduler、shape flag 和组件实例模型在 alpha 之后形成不必要的兼容承诺。公开 API 文档没有列出这些 helper，因此根入口应与文档保持一致。

## 影响范围

- 影响模块：root exports、package exports tests、scheduler/VNode unit tests、API docs。
- 影响对象：`solace` 根入口运行时导出。
- 行为变化：从 package root 移除内部 helper 导出；内部模块源码仍保留这些 helper 供框架实现和内部测试使用。
- 风险等级：中；这是发布面行为变更，但当前包仍未正式发布，且 package consumer smoke 已通过。

## 涉及文件

| 文件                                                                           | 动作 | 说明                                              |
| ------------------------------------------------------------------------------ | ---- | ------------------------------------------------- |
| `src/index.ts`                                                                 | 修改 | 移除内部 helper 的根入口导出                      |
| `tests/integration/package-exports.test.ts`                                    | 修改 | 补充完整公共 API 断言和内部 helper 负向断言       |
| `tests/unit/scheduler/scheduler.test.ts`                                       | 修改 | `queueJob` 改为从内部 scheduler 模块导入          |
| `tests/unit/renderer/vnode-render.test.ts`                                     | 修改 | `ShapeFlags` 改为从内部 shared 模块导入           |
| `docs/api.md`                                                                  | 修改 | 增加 package root 公共 API 列表和内部 helper 说明 |
| `docs/package-usage.md`                                                        | 修改 | 明确内部模块不属于兼容契约                        |
| `solace-project-log/solace-entries/2026-07-10-026-package-root-api-surface.md` | 新增 | 记录本次 root API 收紧                            |
| `solace-project-log/index.md`                                                  | 修改 | 追加本次变更索引                                  |

## 验证记录

| 验证项                    | 命令或方式                                                                                                                                          | 结果                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| TDD RED：内部 helper 泄漏 | `pnpm build && pnpm test tests/integration/package-exports.test.ts`                                                                                 | 失败符合预期，`createComponentInstance` 仍从 package root 暴露                    |
| 定向 GREEN                | `pnpm build && pnpm test tests/integration/package-exports.test.ts tests/unit/scheduler/scheduler.test.ts tests/unit/renderer/vnode-render.test.ts` | 通过，3 个测试文件、16 个测试                                                     |
| 全量质量门禁              | `pnpm quality`                                                                                                                                      | 通过，14 个测试文件、75 个测试                                                    |
| 覆盖率门禁                | `pnpm build && pnpm test:coverage`                                                                                                                  | 通过，statements 93.76%、branches 83.71%、functions 72.68%、lines 93.05%          |
| package consumer smoke    | `pnpm package:smoke`                                                                                                                                | 通过，tarball 可被临时消费者安装使用                                              |
| 完整发布前门禁            | `pnpm release:check`                                                                                                                                | 通过，quality、coverage、package smoke、benchmark 和 3 个 Chromium e2e 测试均通过 |

## 调试记录

并行运行 `pnpm quality`、`pnpm test:coverage` 和 `pnpm package:smoke` 时，coverage 中的 package exports 测试曾短暂失败，原因是多个 Rollup build 同时清理和重建 `dist/`。按发布脚本顺序执行后通过，因此后续验证这类依赖 `dist/` 的命令应避免并行。

## 后续动作

- 后续新增根入口导出时，应同时更新 `docs/api.md`、`docs/package-usage.md` 和 `tests/integration/package-exports.test.ts`。
