# 2026-08-12-003：增加 typed emit contract

## 基本信息

- 日期：2026-08-12
- 类型：JSX/TSX ergonomics / public types / tests / docs
- 状态：已完成

## 变动摘要

新增 opt-in `ComponentEventMap`，并为 `EmitFn`、`ComponentSetupContext`、`ComponentType`
增加事件映射泛型，同时支持 `defineComponent<Props, Events>`。显式提供事件映射后，事件名和
对应 tuple payload 会受到编译期约束；未声明事件映射的组件继续保留宽松 emit 契约。
`ComponentEventMap` 按冻结设计使用 string-indexed `Record`，不承诺 union event variable 的
事件名与 payload 相关性。

beta.4 既有 `defineComponent` 调用的精确返回类型通过兼容 overload 保留。

本切片只扩展公开类型。runtime emit、listener arrays、kebab-case listener resolution 与
DevTools 事件行为不变；精准 JSX `onXxx` listener payload inference 继续 deferred。

## 验证记录

| 验证项        | 命令                                                                                                                                                                      | 结果                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Focused       | `pnpm exec vitest run tests/unit/docs/public-contract-docs.test.ts tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx tests/unit/component/lifecycle.test.ts` | 通过；3 个 test files、18 个 tests                                     |
| Typecheck     | `pnpm quality`                                                                                                                                                            | 通过；常规 typecheck 与 JSX dev typecheck 均包含在完整 quality 链路中  |
| Package tests | `pnpm quality`                                                                                                                                                            | 通过；package tests 为 1 个 test file、16 个 tests                     |
| Packed smoke  | `pnpm package:smoke`                                                                                                                                                      | 通过；tarball 临时消费者安装、类型检查与 Vite build 完成               |
| Quality       | `pnpm quality`                                                                                                                                                            | 通过；主测试为 72 个 test files、644 个 tests，完整 quality 链路退出 0 |

## 边界

- package version、exports、Router、SSR/SSG/hydration、SFC/Vite、DevTools、CI 与 release commands
  未改变。
- 不包含 typed slots，也不包含 JSX listener payload inference。
- 未运行或声称 `pnpm release:check`。
