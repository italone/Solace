# 2026-07-10-027：拆分 package exports 测试门禁

## 基本信息

- 日期：2026-07-10
- 类型：测试配置 / CI / 脚本
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

将依赖 `dist/` 的 package exports 集成测试从默认 Vitest 测试集拆出，新增 `vitest.package.config.ts` 和 `pnpm test:package`。默认 `pnpm test` 和 `pnpm test:coverage` 不再依赖构建产物；`pnpm quality` 和 CI 仍显式运行 package exports 测试。

## 变动原因

`tests/integration/package-exports.test.ts` 验证发布包产物和 package self-reference，天然依赖 `dist/`。把它混在默认测试和 coverage 中，会让干净工作区或并行验证时受到 `dist` 清理/重建影响。拆分后，源码测试和构建产物测试边界更清晰。

## 影响范围

- 影响模块：Vitest 主配置、package exports Vitest 配置、package scripts、CI。
- 影响对象：`pnpm test`、`pnpm test:coverage`、`pnpm test:package`、`pnpm quality`、GitHub Actions。
- 行为变化：默认测试运行 13 个源码测试文件；package exports 测试通过 `pnpm test:package` 单独运行并先构建。
- 风险等级：中低；测试门禁拆分但未减少覆盖范围，完整发布门禁已通过。

## 涉及文件

| 文件                                                                             | 动作 | 说明                                                     |
| -------------------------------------------------------------------------------- | ---- | -------------------------------------------------------- |
| `vitest.config.ts`                                                               | 修改 | 默认测试排除 `tests/integration/package-exports.test.ts` |
| `vitest.package.config.ts`                                                       | 新增 | 专门运行 package exports 集成测试                        |
| `package.json`                                                                   | 修改 | 新增 `test:package`，并将其接入 `quality`                |
| `.github/workflows/ci.yml`                                                       | 修改 | 增加 Package exports 测试步骤                            |
| `solace-project-log/solace-entries/2026-07-10-027-package-exports-test-split.md` | 新增 | 记录本次测试门禁拆分                                     |
| `solace-project-log/index.md`                                                    | 修改 | 追加本次变更索引                                         |

## 验证记录

| 验证项               | 命令或方式           | 结果                                                                              |
| -------------------- | -------------------- | --------------------------------------------------------------------------------- |
| 默认测试             | `pnpm test`          | 通过，13 个测试文件、69 个测试                                                    |
| package exports 测试 | `pnpm test:package`  | 通过，先构建，再运行 1 个测试文件、6 个测试                                       |
| 覆盖率门禁           | `pnpm test:coverage` | 通过，13 个测试文件、69 个测试；不再依赖 package exports 的 `dist` 检查           |
| 全量质量门禁         | `pnpm quality`       | 通过，typecheck、JSX dev typecheck、lint、默认测试和 package exports 测试均通过   |
| 完整发布前门禁       | `pnpm release:check` | 通过，quality、coverage、package smoke、benchmark 和 3 个 Chromium e2e 测试均通过 |

## 后续动作

- 后续新增依赖构建产物的测试时，应放入专门脚本或配置，避免混入默认源码测试。
