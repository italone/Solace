# 2026-07-10-016：增加 package consumer smoke 校验

## 基本信息

- 日期：2026-07-10
- 类型：脚本 / 测试 / 文档
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

新增 `pnpm package:smoke`，用于发布前验证真实 tarball 能被临时消费者项目安装和使用。该脚本会构建 Solace、执行 `pnpm pack`、安装生成的 `.tgz`、类型检查 JSX 消费入口，并分别校验 ESM import 和 CJS require 能加载 `solace`、`solace/jsx-runtime`、`solace/jsx-dev-runtime`。

## 变动原因

此前 `pnpm pack --dry-run` 只能验证发布包清单，无法证明外部项目安装 tarball 后的 TypeScript JSX、package exports、ESM/CJS 解析都可正常工作。增加消费者 smoke test 后，发布前可以覆盖更接近真实用户的消费路径。

## 影响范围

- 影响模块：package release smoke、Node 脚本、包使用文档。
- 影响对象：本地打包、临时消费者安装、TypeScript JSX 配置、ESM/CJS package exports。
- 行为变化：新增 `pnpm package:smoke` 命令；运行时核心未改动。
- 风险等级：低；脚本只写入系统临时目录，并在完成或失败后清理。

## 涉及文件

| 文件                                                                         | 动作 | 说明                                             |
| ---------------------------------------------------------------------------- | ---- | ------------------------------------------------ |
| `scripts/package-consumer-smoke.mjs`                                         | 新增 | 构建、pack、安装 tarball、类型检查和入口加载校验 |
| `package.json`                                                               | 修改 | 增加 `package:smoke` 脚本                        |
| `docs/package-usage.md`                                                      | 修改 | 记录发布前消费者 smoke 命令和覆盖范围            |
| `solace-project-log/solace-entries/2026-07-10-016-package-consumer-smoke.md` | 新增 | 记录本次 package consumer smoke 变更             |
| `solace-project-log/index.md`                                                | 修改 | 追加本次变更索引                                 |

## 验证记录

| 验证项                 | 命令或方式           | 结果                                                                                     |
| ---------------------- | -------------------- | ---------------------------------------------------------------------------------------- |
| package consumer smoke | `pnpm package:smoke` | 通过，tarball 可安装到临时消费者项目，JSX typecheck、ESM import 和 CJS require 均通过    |
| benchmark              | `pnpm benchmark`     | 通过，3 个 benchmark 文件、3 个测试                                                      |
| 全量质量门禁           | `pnpm quality`       | 通过，typecheck、JSX dev typecheck、lint、build、14 个测试文件和 66 个测试均通过         |
| 浏览器 e2e             | `pnpm test:e2e`      | 首次在沙箱内因无法绑定 `127.0.0.1:5174` 失败；授权端口绑定后通过，3 个 Chromium 测试通过 |

## 后续动作

- 发布前继续保留 `private: true` 的状态判断；真正发布时再移除或调整该字段。
- 如后续新增公共子路径，应同步扩展 smoke 脚本中的 ESM/CJS 入口校验。
