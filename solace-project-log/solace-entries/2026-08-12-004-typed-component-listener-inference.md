# 2026-08-12-004：增加 typed component listener inference

## 基本信息

- 日期：2026-08-12
- 类型：JSX/TSX ergonomics / public types / tests / docs
- 状态：已完成

## 变动摘要

显式 `ComponentEventMap` 现在会为 JSX/TSX 推导 canonical `onXxx` listener 与对应的
exact tuple 参数，并同时接受单个 listener 函数和 listener 数组。kebab-case 事件名映射到
camelized canonical listener key；Events 推导出的 listener 会覆盖 Props 中的同名 callback
类型，其他 Props callbacks 继续保留。未提供 event map 的组件保持 permissive listener 契约。

本切片只修改 JSX 公开类型；`h`、runtime emit/dispatch、DevTools payload 与 package exports
未改变。generic component props inference 也继续保留，这是本轮随质量门禁完成的修复。

## 验证记录

| 验证项        | 命令                                                                                                                                                                      | 结果                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Focused       | `pnpm exec vitest run tests/unit/docs/public-contract-docs.test.ts tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx tests/unit/component/lifecycle.test.ts` | 通过；3 个 test files、18 个 tests                                     |
| Typechecks    | `pnpm quality`                                                                                                                                                            | 通过；常规 typecheck 与 JSX dev typecheck 均包含在完整 quality 链路中  |
| Package tests | `pnpm quality`                                                                                                                                                            | 通过；package tests 为 1 个 test file、16 个 tests                     |
| Packed smoke  | `pnpm package:smoke`                                                                                                                                                      | 通过；tarball 临时消费者安装、类型检查与 Vite build 完成               |
| Quality       | `pnpm quality`                                                                                                                                                            | 通过；主测试为 72 个 test files、644 个 tests，完整 quality 链路退出 0 |

## 边界

- package version、exports、Router、SSR/SSG/hydration、SFC/Vite、DevTools、CI 与 release commands
  未改变。
- 不包含 typed slots、runtime validation 或 `h` listener inference。
- 未运行或声称 `pnpm release:check`。
