# 2026-07-10-030：同步运行环境与发布门禁文档

## 基本信息

- 日期：2026-07-10
- 类型：文档 / 工程配置一致性
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

同步 README、package usage 和 release 文档中的运行环境与发布门禁说明。README 现在与 `package.json` 的 Node engines 保持一致，release gate 文档明确包含 package exports 测试和 coverage thresholds。

## 变动原因

`package.json` 已声明 Node `^20.19.0 || >=22.12.0`，但 README 仍写 Node 18+。同时 release gate 已经包含 coverage 和 package exports 测试，部分文档说明仍停留在旧流程。更新后文档与实际脚本一致。

## 影响范围

- 影响模块：README、package usage docs、release docs。
- 影响对象：Node 版本要求、CI 门禁说明、release gate 说明。
- 行为变化：无运行时行为变化。
- 风险等级：低；仅修正文档说明。

## 涉及文件

| 文件                                                                        | 动作 | 说明                                                                       |
| --------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------- |
| `readme.md`                                                                 | 修改 | 对齐 Node engines，并更新 CI 门禁说明                                      |
| `docs/package-usage.md`                                                     | 修改 | 更新 `release:check` 覆盖范围说明                                          |
| `docs/release.md`                                                           | 修改 | 明确 release gate 包含默认测试、package exports 测试和 coverage thresholds |
| `solace-project-log/solace-entries/2026-07-10-030-runtime-doc-alignment.md` | 新增 | 记录本次文档一致性修正                                                     |
| `solace-project-log/index.md`                                               | 修改 | 追加本次变更索引                                                           |

## 验证记录

| 验证项       | 命令或方式        | 结果                                                                            |
| ------------ | ----------------- | ------------------------------------------------------------------------------- |
| 文档引用检查 | `rg -n "Node\\.js | \\^20\\.19\\.0                                                                  | >=22\\.12\\.0 | coverage thresholds | package exports | benchmark smoke | e2e" readme.md docs package.json .github/workflows/ci.yml` | 通过，文档和配置中的关键说明可检索 |
| 全量质量门禁 | `pnpm quality`    | 通过，typecheck、JSX dev typecheck、lint、默认测试和 package exports 测试均通过 |

## 后续动作

- 后续修改 `engines.node` 或 `release:check` 脚本时，应同步更新 README、`docs/package-usage.md` 和 `docs/release.md`。
