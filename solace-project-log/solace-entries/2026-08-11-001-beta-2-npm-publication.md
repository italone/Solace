# 2026-08-11-001：发布 beta.2 package

## 基本信息

- 日期：2026-08-11
- 类型：发布 / registry smoke / 文档 / project log
- 状态：npm 发布完成，远端 tag 待重试
- 关联提交：`f68d877`；本地发布 tag：`v0.1.0-beta.2`

## 变动摘要

发布 `@italone/solace@0.1.0-beta.2` 到 npm `beta` dist-tag，并保持 npm `latest` 指向
`0.0.5`。本次版本记录 beta router 公共契约、JSX/TSX runtime contract、SSR/hydration
deferred boundary 和 DevTools extension E2E 覆盖。

## 影响范围

- 影响模块：npm `beta` dist-tag、published tarball docs、项目状态文档、Git release tag。
- 影响对象：通过 `pnpm add @italone/solace@beta` 安装的消费者，以及查看 npm package README/docs 的读者。
- 行为变化：npm `beta` dist-tag 从 `0.1.0-beta.1` 移动到 `0.1.0-beta.2`；npm `latest` 继续指向 `0.0.5`。
- 风险等级：低；运行时未新增变更，发布前完整 release gate 和发布后 registry smoke 均通过。

## 验证记录

| 验证项                 | 命令或方式                                                                  | 结果                                                                   |
| ---------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Beta publish gate      | `pnpm release:publish:beta`                                                 | 通过；发布 `@italone/solace@0.1.0-beta.2` 到 npm `beta` dist-tag       |
| Release check          | `pnpm release:check`                                                        | 通过；由 publish 命令重新运行                                          |
| Coverage               | `pnpm test:coverage`                                                        | 通过；statements 95.29%、branches 90.54%、functions 96.7%、lines 95.3% |
| Package smoke          | `pnpm package:smoke`                                                        | 通过；packed consumer 安装 `0.1.0-beta.2` 并构建                       |
| Browser e2e            | `pnpm test:e2e`                                                             | 通过；4 个 e2e 测试通过                                                |
| DevTools extension e2e | `pnpm test:e2e:devtools-extension`                                          | 通过；2 个 e2e 测试通过                                                |
| Registry dist-tags     | `npm view @italone/solace dist-tags --json`                                 | 通过；`latest -> 0.0.5`，`beta -> 0.1.0-beta.2`                        |
| Registry version       | `npm view @italone/solace@0.1.0-beta.2 version`                             | 通过；返回 `0.1.0-beta.2`                                              |
| Registry beta smoke    | `npm exec --yes --package @italone/solace@beta -- node -e "<import smoke>"` | 通过；root/server/vite/devtools 可导入，SSR render 输出正确            |
| Published tarball      | `npm pack @italone/solace@0.1.0-beta.2 --pack-destination /private/tmp/...` | 通过；发布包包含 48 个文件                                             |
| Git tag push           | `git push origin v0.1.0-beta.2`                                             | 未完成；GitHub 443 连接失败                                            |

## 后续动作

- 重试 `git push origin v0.1.0-beta.2`，并用 `git ls-remote --tags origin v0.1.0-beta.2` 核对远端 tag。
- 后续仍保持 `0.1.x` 在 npm `beta` 线，除非维护者另行决定把某个版本提升为 npm `latest`。
