# 2026-08-05-001：记录 beta npm 发布

## 基本信息

- 日期：2026-08-05
- 类型：发布 / 文档 / registry smoke / project log
- 状态：已完成
- 关联提交：`125a78a`、`585ef6a`；发布 tag：`v0.1.0-beta.0`

## 变动摘要

发布 `@italone/solace@0.1.0-beta.0` 到 npm `beta` dist-tag，并保持 npm `latest` 指向
`0.0.5`。发布后同步 README、package usage、roadmap 和 project status 文档，明确当前仍是
0.1.0 beta 线，兼容性承诺只覆盖文档化公共入口，内部模块和窄 SFC/Vite compiler surface 仍不稳定。

## 变动原因

仓库已经进入 beta 线，但发布前文档仍区分“本地 beta 线”和 npm `latest`。完成 beta 发布后，需要将
registry、Git tag、安装方式和项目完成度记录对齐，避免用户误把 `latest`、`beta` 和 `main` 状态混为一谈。

## 影响范围

- 影响模块：npm 发布状态、release coordination 文档、项目完成度文档、README、package usage、roadmap、项目日志。
- 影响对象：维护者、从 npm 安装 Solace 的消费者、查看完成度和兼容性边界的读者。
- 行为变化：npm `beta` dist-tag 指向 `0.1.0-beta.0`；npm `latest` 继续指向 `0.0.5`。运行时代码无新增变化。
- 风险等级：低；发布已通过完整 release gate，后续变更仅同步发布事实和日志。

## 涉及文件

| 文件                                                                       | 动作 | 说明                                          |
| -------------------------------------------------------------------------- | ---- | --------------------------------------------- |
| `CHANGELOG.md`                                                             | 修改 | Changesets 生成 `0.1.0-beta.0` 版本记录       |
| `package.json`                                                             | 修改 | package version 进入 `0.1.0-beta.0` beta 线   |
| `docs/project-status.md`                                                   | 修改 | 记录 npm `latest`/`beta` dist-tags 和发布门禁 |
| `docs/project-status.zh-CN.md`                                             | 修改 | 同步中文发布状态和兼容性边界                  |
| `docs/package-usage.md`                                                    | 修改 | 增加 `pnpm add @italone/solace@beta` 安装说明 |
| `docs/roadmap.md`                                                          | 修改 | 将当前阶段改为已发布 beta 线                  |
| `readme.md`                                                                | 修改 | 同步英文 README 的 beta 发布和安装说明        |
| `readme.zh-CN.md`                                                          | 修改 | 同步中文 README 的 beta 发布和安装说明        |
| `solace-project-log/solace-entries/2026-08-05-001-beta-npm-publication.md` | 新增 | 本日志                                        |
| `solace-project-log/index.md`                                              | 修改 | 追加本日志索引                                |

## 验证记录

| 验证项                   | 命令或方式                                                                  | 结果                                                                 |
| ------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Beta publish gate        | `pnpm release:publish:beta`                                                 | 通过；发布 `@italone/solace@0.1.0-beta.0` 到 npm `beta` dist-tag     |
| Registry dist-tags       | `npm view @italone/solace dist-tags --json`                                 | 通过；`latest -> 0.0.5`，`beta -> 0.1.0-beta.0`                      |
| Registry versions        | `npm view @italone/solace versions --json`                                  | 通过；版本列表包含 `0.1.0-beta.0`                                    |
| Git tag                  | `git tag --list v0.1.0-beta.0`                                              | 通过；本地 tag 存在，且已 push 到远端                                |
| Publishable readiness    | `pnpm release:readiness -- --publishable`                                   | 通过；Git 同步状态已检查                                             |
| Quality gate             | `pnpm quality`                                                              | 通过；format、build、typecheck、lint、unit tests、package tests 均过 |
| Registry beta smoke      | `npm exec --yes --package @italone/solace@beta -- node -e "<import smoke>"` | 通过；root/server/vite/devtools 入口可导入，SSR render 输出正确      |
| Git synchronization      | `git rev-list --left-right --count origin/main...HEAD`                      | 通过；`0 0`                                                          |
| Working tree cleanliness | `git status --short --branch`                                               | 通过；`main...origin/main`                                           |

## 后续动作

- 继续把 SFC/Vite contract 保持在窄 compiler surface，不在 beta 线内承诺未文档化语法或生成代码形状。
- 继续收敛 router beta API，route names、aliases、route props、scroll behavior、memory history、SSR/hydration integration、auth 和 permissions 保持 deferred。
- 后续若要把 `0.1.x` 推为 npm `latest`，需重新执行发布门禁、registry 检查和维护者确认。
