# 2026-08-05-002：准备 beta package 文档刷新

## 基本信息

- 日期：2026-08-05
- 类型：发布准备 / 文档 / package metadata / project log
- 状态：已完成
- 关联提交：本条日志随记录提交一并提交

## 变动摘要

将 repository package version 推进到 `0.1.0-beta.1`，并刷新会进入 npm tarball 的 README、
package usage 和 project status 文档。新文档不再把 beta 描述为本地线，而是区分 npm `latest`
稳定线、npm `beta` 安装线和需要通过 registry 命令核对的移动 dist-tag。

## 变动原因

发布后审计发现 `@italone/solace@0.1.0-beta.0` 的 npm tarball 仍包含发布前文档，其中 README 和
package usage 将 beta 描述为 local-only。npm 已发布版本不可覆盖，因此需要准备后续 beta 版本，让下一次
`@beta` tarball 自带正确的发布状态和兼容性边界说明。

## 影响范围

- 影响模块：package version、changelog、README、package usage、project status、项目日志。
- 影响对象：从 npm `@beta` 安装或查看 package README/docs 的消费者。
- 行为变化：仓库 package version 从 `0.1.0-beta.0` 推进到 `0.1.0-beta.1`；运行时代码无变化。
- 风险等级：低；只调整 package metadata 和文档，但下一次发布前仍必须完整运行 release gate。

## 涉及文件

| 文件                                                                           | 动作 | 说明                                      |
| ------------------------------------------------------------------------------ | ---- | ----------------------------------------- |
| `package.json`                                                                 | 修改 | 将 package version 推进到 `0.1.0-beta.1`  |
| `CHANGELOG.md`                                                                 | 修改 | 新增 `0.1.0-beta.1` patch 记录            |
| `readme.md`                                                                    | 修改 | 将 beta 状态描述改为 package build/安装线 |
| `readme.zh-CN.md`                                                              | 修改 | 同步中文 README                           |
| `docs/package-usage.md`                                                        | 修改 | 避免写死移动中的 npm `beta` dist-tag      |
| `docs/project-status.md`                                                       | 修改 | 记录 beta.1 候选和 registry 核对边界      |
| `docs/project-status.zh-CN.md`                                                 | 修改 | 同步中文项目状态                          |
| `solace-project-log/solace-entries/2026-08-05-002-beta-package-doc-refresh.md` | 新增 | 本日志                                    |
| `solace-project-log/index.md`                                                  | 修改 | 追加本日志索引                            |

## 验证记录

| 验证项                | 命令或方式                                                                    | 结果                                              |
| --------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------- |
| Published beta audit  | `npm pack @italone/solace@0.1.0-beta.0 --pack-destination /private/tmp/...`   | 发现 beta.0 tarball 文档仍含 local-only beta 表述 |
| Tarball README audit  | `tar -xOf ... package/readme.md \| sed -n '17,33p'`                           | 确认 README 是发布前文案                          |
| Tarball package usage | `tar -xOf ... package/docs/package-usage.md \| sed -n '1,24p'`                | 确认 package usage 是发布前文案                   |
| Version availability  | `npm view @italone/solace@0.1.0-beta.1 version`                               | 预期 404；registry 尚未占用 `0.1.0-beta.1`        |
| Release readiness     | `pnpm release:readiness`                                                      | 通过；package 为 `@italone/solace@0.1.0-beta.1`   |
| Package smoke         | `pnpm package:smoke`                                                          | 通过；packed consumer 安装 `0.1.0-beta.1` 并构建  |
| Quality gate          | `pnpm quality`                                                                | 通过；format、build、typecheck、lint、tests 均过  |
| Beta.1 tarball README | `tar -xOf /private/tmp/solace-beta1-audit/... package/readme.md`              | 通过；包内 README 已描述 beta 安装线              |
| Beta.1 package status | `tar -xOf /private/tmp/solace-beta1-audit/... package/docs/project-status.md` | 通过；包内 project status 已记录 `0.1.0-beta.1`   |

## 后续动作

- 发布 `0.1.0-beta.1` 前必须重新运行 `pnpm release:readiness -- --publishable`、`pnpm release:check` 和 registry 版本占用检查。
- 只有维护者再次明确确认 npm 发布后，才可以执行 `pnpm release:publish:beta`。
