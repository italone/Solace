# 2026-08-12-002：固化 registry contract smoke

## 基本信息

- 日期：2026-08-12
- 类型：release tooling / registry contract / tests / docs
- 状态：已完成

## 变动摘要

新增显式 `pnpm registry:smoke -- <version-or-dist-tag>`，在临时消费者中安装指定 npm package，
验证八个受保护公开入口、服务端 paragraph 输出和私有 deep path 阻断。该命令不进入普通 CI、
`quality`、candidate 或 publish gate，不修改 runtime、版本、tag 或 dist-tag。

真实 package 命令验证发现 pnpm 会向脚本转发参数分隔符 `--`，因此参数解析器仅对该前缀做
规范化，并继续执行原有的单目标和安全格式校验。两个可被 TypeScript 测试导入的 `.mjs`
模块同时按仓库既有模式补齐同名 `.d.mts` 声明，不加入 package exports。

## 验证记录

| 验证项               | 命令                                                                                                                                                              | 结果                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Focused tests        | `pnpm exec vitest run tests/unit/docs/release-docs.test.ts tests/unit/scripts/registry-contract-smoke.test.ts tests/unit/scripts/release-readiness-check.test.ts` | 通过；3 个 test files、33 个 tests                                              |
| Exact registry smoke | `pnpm registry:smoke -- 0.1.0-beta.4`                                                                                                                             | 通过；resolved version 为 `0.1.0-beta.4`，八入口、SSR 和 private entry 检查通过 |
| Quality              | `pnpm quality`                                                                                                                                                    | 通过；72 个 test files、644 个 tests，package tests 为 1 个文件、16 个测试      |
| Release readiness    | `pnpm release:readiness`                                                                                                                                          | 通过；现有 candidate/release gate 未改变                                        |
| Formatting           | `pnpm format:check`                                                                                                                                               | 通过                                                                            |

## 边界

- `src/**`、package version、exports、Changesets、Git tag 与 npm dist-tags 未改变。
- registry 网络失败属于 install stage，不应被描述为 package contract regression。
