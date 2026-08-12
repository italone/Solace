# 2026-08-12-001：发布 beta.4 契约稳定版

## 基本信息

- 日期：2026-08-12
- 类型：发布 / registry smoke / 契约冻结 / 文档 / project log
- 状态：npm 发布完成，远端 tag 待重试
- 关联提交：`fbe6984`；本地发布 tag：`v0.1.0-beta.4`

## 变动摘要

发布 `@italone/solace@0.1.0-beta.4` 到 npm `beta` dist-tag，并保持 npm `latest` 指向
`0.0.5`。本次版本严格冻结当前 runtime，发布 buffered async SSR、sequential async SSG、
prepare-then-commit async hydration、八入口兼容性策略，以及 Operations Console 的真实 package
升级证据；不增加 streaming、router-aware SSR/hydration、auth、SFC 或 DevTools 新能力。

## 影响范围

- 影响模块：npm `beta` dist-tag、公开 package 契约、published tarball docs、项目状态文档、Git release tag。
- 影响对象：通过 `pnpm add @italone/solace@beta` 安装的消费者。
- 行为变化：npm `beta` 从 `0.1.0-beta.2` 移动到 `0.1.0-beta.4`；npm `latest` 继续指向 `0.0.5`。
- 风险等级：低；冻结线没有 `src/**` 运行时变更，发布前完整门禁和发布后 registry smoke 均通过。

## 验证记录

| 验证项                     | 命令或方式                                   | 结果                                                                              |
| -------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------- |
| Candidate gate             | `pnpm release:candidate:check`               | 通过；publishable readiness、精确 beta.2 upgrade smoke 和完整 release gate 均通过 |
| Beta publish gate          | `pnpm release:publish:beta`                  | 通过；发布 `@italone/solace@0.1.0-beta.4` 到 npm `beta` dist-tag                  |
| Unit/integration tests     | publish gate 中的 Vitest                     | 通过；71 个文件、626 个测试                                                       |
| Package exports            | publish gate 中的 `pnpm test:package`        | 通过；16 个测试                                                                   |
| Coverage                   | publish gate 中的 `pnpm test:coverage`       | 通过；94.28% statements、89.18% branches、96.28% functions、94.32% lines          |
| Browser e2e                | publish gate 中的 `pnpm test:e2e`            | 通过；Chromium、Firefox、WebKit 共 24 个测试                                      |
| DevTools extension e2e     | `pnpm test:e2e:devtools-extension`           | 通过；2 个 Chromium 测试                                                          |
| Registry dist-tags/version | `npm view`                                   | 通过；`latest -> 0.0.5`、`beta -> 0.1.0-beta.4`，精确 beta.4 版本可查询           |
| Registry contract smoke    | 从 `@italone/solace@beta` 安装并导入公开入口 | 通过；八个公开入口可导入，SSR 输出正确，私有 `dist/index.js` 深路径被阻断         |
| Published tarball          | publish gate 的 pack 输出                    | 通过；50 个文件，154,815 bytes                                                    |
| Local release tag          | `git rev-parse v0.1.0-beta.4^{}`             | 通过；annotated tag 解引用到 `fbe69842b13a1be6d2207976cb1f43e21ae369ef`           |
| Git tag push               | `git push origin v0.1.0-beta.4`              | 待完成；GitHub 443/DNS 网络失败，需重试并用 `git ls-remote` 核验                  |

## 已知残余

- npm tarball 一经发布不可覆盖。beta.4 tarball 中 README/status 仍包含发布前的 candidate / beta.2
  published 措辞；仓库文档已在发布后纠正，此问题留待后续版本自然更新，不发布 beta.5 规避。
- 本地 tag 已由 Changesets 创建且指向正确发布提交；只有远端 tag 同步仍待 GitHub 网络恢复。

## 后续动作

- 重试 `git push origin main` 和 `git push origin v0.1.0-beta.4`。
- 用 `git ls-remote --tags origin v0.1.0-beta.4` 核对远端 tag 解引用后指向 `fbe6984`。
- 下一轮迭代继续遵守冻结边界；任何扩大公共契约的工作应另行设计，不在 beta.4 上追加。
