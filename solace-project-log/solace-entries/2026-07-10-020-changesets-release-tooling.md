# 2026-07-10-020：补齐 Changesets 发布工具链

## 基本信息

- 日期：2026-07-10
- 类型：依赖 / 脚本 / 文档
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

安装 `@changesets/cli`，新增 Changesets 配置和发布相关脚本，并补充 `docs/release.md`。本地发布流程现在包含 changeset 创建、版本应用、完整 release gate 和 publish 命令入口。

## 变动原因

仓库已经有 `.changeset/initial-alpha.md` 和发布流程说明，但此前没有安装 Changesets CLI，也缺少可执行的 version/publish 脚本。补齐工具链后，发布记录不再只是静态文件，可以通过项目脚本执行。

## 影响范围

- 影响模块：package scripts、Changesets 配置、release docs、lockfile。
- 影响对象：`pnpm changeset`、`pnpm release:version`、`pnpm release:publish`、发布前检查说明。
- 行为变化：新增发布工具命令；运行时核心未改动。
- 风险等级：中；新增 devDependency 和 lockfile 变更，真正 publish 仍需先处理 `private: true` 和 npm 权限。

## 涉及文件

| 文件                                                                             | 动作 | 说明                                                      |
| -------------------------------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `package.json`                                                                   | 修改 | 增加 `@changesets/cli` 和发布相关脚本                     |
| `pnpm-lock.yaml`                                                                 | 修改 | 锁定 `@changesets/cli` 及其依赖                           |
| `.changeset/config.json`                                                         | 新增 | 配置 Changesets changelog、base branch、access 等默认行为 |
| `docs/release.md`                                                                | 新增 | 记录本地 gate、changeset、version 和 publish 流程         |
| `docs/package-usage.md`                                                          | 修改 | 增加 release 文档指引                                     |
| `readme.md`                                                                      | 修改 | 在当前能力中补充发布门禁说明                              |
| `solace-project-log/solace-entries/2026-07-10-020-changesets-release-tooling.md` | 新增 | 记录本次 Changesets 工具链变更                            |
| `solace-project-log/index.md`                                                    | 修改 | 追加本次变更索引                                          |

## 验证记录

| 验证项                    | 命令或方式                    | 结果                                                                                                    |
| ------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| Changesets CLI            | `pnpm changeset --help`       | 通过，CLI 可执行并显示命令帮助                                                                          |
| Changesets version script | `pnpm release:version --help` | 通过，`changeset version` 可执行并显示帮助                                                              |
| Changesets status         | `pnpm exec changeset status`  | 当前目录不是 Git 仓库且没有 `main` 分支参照，因此按预期失败；不作为本次阻塞                             |
| 完整发布前门禁            | `pnpm release:check`          | 通过，quality、package smoke、benchmark 和 3 个 Chromium e2e 测试均通过；tarball 包含 `docs/release.md` |

## 后续动作

- 真正发布前需要明确包是否公开发布，移除或调整 `package.json` 中的 `private: true`。
- 初始化 Git 仓库并建立 `main` 分支后，可以使用 `changeset status` 检查分支上的变更记录状态。
