# 2026-07-10-003：配置代码质量与 CI

## 基本信息

- 日期：2026-07-10
- 类型：配置 / 测试 / 构建
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

为 Solace 工作区新增 ESLint、Prettier、Husky、lint-staged 和 TypeScript ESLint 依赖，建立本地质量门禁脚本与 GitHub Actions CI。质量门禁会按顺序执行类型检查、静态检查、测试和构建。

## 变动原因

阶段 0 的第三步需要把后续开发的基本质量标准固化为可重复命令和 CI 流程，避免后续功能阶段在类型、静态检查、测试或构建产物上发生回归。

## 影响范围

- 影响模块：质量工具链、格式化配置、CI 工作流、依赖锁定。
- 影响对象：本地开发命令、GitHub Actions、后续提交前检查。
- 行为变化：新增 `pnpm lint`、`pnpm format` 和 `pnpm quality`；运行时代码行为未变化。
- 风险等级：中低；当前测试集为空，`pnpm test` 依赖 Step 02 的引导期 `passWithNoTests` 配置。

## 涉及文件

| 文件                                                                        | 动作 | 说明                                                                |
| --------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------- |
| `package.json`                                                              | 修改 | 增加质量脚本和质量工具 devDependencies                              |
| `pnpm-lock.yaml`                                                            | 修改 | 锁定 ESLint、Prettier、TypeScript ESLint、Husky、lint-staged 依赖   |
| `eslint.config.js`                                                          | 新增 | 配置 ESLint flat config 和生成目录忽略规则                          |
| `.prettierrc`                                                               | 新增 | 配置统一格式化规则                                                  |
| `.github/workflows/ci.yml`                                                  | 新增 | 配置 CI 安装依赖并执行类型检查、Lint、测试和构建                    |
| `.gitignore`                                                                | 新增 | 避免依赖、构建产物、覆盖率和本地环境文件在后续 Git 初始化时被误提交 |
| `solace-project-log/solace-entries/2026-07-10-003-quality-ci-configured.md` | 新增 | 记录本次质量与 CI 配置                                              |
| `solace-project-log/index.md`                                               | 修改 | 追加本次变更索引                                                    |

## 验证记录

| 验证项          | 命令或方式                                                                          | 结果                                                             |
| --------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 质量门禁        | `pnpm quality`                                                                      | 通过，退出码为 0                                                 |
| ESLint 定向检查 | `pnpm exec eslint src/index.ts rollup.config.mjs vitest.config.ts eslint.config.js` | 通过，退出码为 0                                                 |
| 生成产物忽略    | 人工检查 `.gitignore`                                                               | 通过，覆盖 `node_modules/`、`dist/`、`coverage/`、`.pnpm-store/` |

## 后续动作

- 后续添加第一批真实测试后，评估移除 Vitest 的 `passWithNoTests`。
