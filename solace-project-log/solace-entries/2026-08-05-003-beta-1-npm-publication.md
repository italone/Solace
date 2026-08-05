# 2026-08-05-003：发布 beta.1 package 文档刷新

## 基本信息

- 日期：2026-08-05
- 类型：发布 / registry smoke / 文档 / project log
- 状态：已完成
- 关联提交：`57479b4`；发布 tag：`v0.1.0-beta.1`

## 变动摘要

发布 `@italone/solace@0.1.0-beta.1` 到 npm `beta` dist-tag，并保持 npm `latest` 指向
`0.0.5`。这次 beta 发布的主要目标是让 npm tarball 自带的 README 和 docs 反映已发布 beta
安装线，而不是继续保留 `0.1.0-beta.0` tarball 中的 local-only 文档状态。

## 变动原因

`0.1.0-beta.0` 已经成功发布，但发布后审计发现该不可变 tarball 内的 README/docs 仍包含发布前文案。
因此需要发布 `0.1.0-beta.1`，把已同步的项目状态文档带入 npm `@beta` 消费路径。

## 影响范围

- 影响模块：npm `beta` dist-tag、published tarball docs、Git release tag、项目状态文档、项目日志。
- 影响对象：通过 `pnpm add @italone/solace@beta` 安装的消费者，以及查看 npm package README/docs 的读者。
- 行为变化：npm `beta` dist-tag 从 `0.1.0-beta.0` 移动到 `0.1.0-beta.1`；npm `latest` 继续指向 `0.0.5`。运行时代码无新增变化。
- 风险等级：低；发布前完整 release gate 已通过，发布后 registry smoke 和 tarball 文档检查已通过。

## 涉及文件

| 文件                                                                         | 动作 | 说明                         |
| ---------------------------------------------------------------------------- | ---- | ---------------------------- |
| `docs/project-status.md`                                                     | 修改 | 记录 `0.1.0-beta.1` 发布状态 |
| `docs/project-status.zh-CN.md`                                               | 修改 | 同步中文发布状态             |
| `solace-project-log/solace-entries/2026-08-05-003-beta-1-npm-publication.md` | 新增 | 本日志                       |
| `solace-project-log/index.md`                                                | 修改 | 追加本日志索引               |

## 验证记录

| 验证项                 | 命令或方式                                                                  | 结果                                                                     |
| ---------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Beta publish gate      | `pnpm release:publish:beta`                                                 | 通过；发布 `@italone/solace@0.1.0-beta.1` 到 npm `beta` dist-tag         |
| Release check          | `pnpm release:check`                                                        | 通过；由 publish 命令重新运行                                            |
| Coverage               | `pnpm test:coverage`                                                        | 通过；statements 95.44%、branches 90.28%、functions 96.86%、lines 95.41% |
| Package smoke          | `pnpm package:smoke`                                                        | 通过；packed consumer 安装 `0.1.0-beta.1` 并构建                         |
| jsdom benchmark        | `pnpm benchmark`                                                            | 通过；5 个 benchmark 测试通过                                            |
| Browser benchmark      | `pnpm benchmark:browser`                                                    | 通过；1 个 Chromium production browser benchmark 测试通过                |
| Browser e2e            | `pnpm test:e2e`                                                             | 通过；4 个 e2e 测试通过                                                  |
| Registry dist-tags     | `npm view @italone/solace@0.1.0-beta.1 version dist-tags --json`            | 通过；`latest -> 0.0.5`，`beta -> 0.1.0-beta.1`                          |
| Registry beta smoke    | `npm exec --yes --package @italone/solace@beta -- node -e "<import smoke>"` | 通过；root/server/vite/devtools 入口可导入，SSR render 输出正确          |
| Published tarball docs | `npm pack @italone/solace@0.1.0-beta.1 --pack-destination /private/tmp/...` | 通过；发布包包含更新后的 README 和 project status 文档                   |
| Git tag push           | `git -c http.version=HTTP/1.1 push origin v0.1.0-beta.1`                    | 通过；远端 tag push 返回成功                                             |
| Git tag remote audit   | `git -c http.version=HTTP/1.1 ls-remote --tags origin v0.1.0-beta.1`        | 未完成；GitHub 443 连接超时                                              |

## 后续动作

- 后续仍保持 `0.1.x` 在 npm `beta` 线，除非维护者另行决定把某个版本提升为 npm `latest`。
- 继续保持 SFC/Vite 为窄 compiler surface，兼容性承诺只覆盖文档化公共入口。
