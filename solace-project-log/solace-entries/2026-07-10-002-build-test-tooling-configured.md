# 2026-07-10-002：配置构建与测试工具

## 基本信息

- 日期：2026-07-10
- 类型：配置 / 构建 / 测试
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

为 Solace 工作区补齐本地开发、类型检查、测试、覆盖率、性能测试和库构建脚本。新增 Vitest 与 Rollup 配置，使当前空入口也能完成类型检查、空测试集验证和 ESM/CJS/类型声明产物构建。

## 变动原因

阶段 0 的第二步需要建立后续源码开发的基础工具链。严格 TypeScript 配置、可运行测试命令和库构建输出是后续响应式核心、渲染器和组件系统持续验证的前提。

## 影响范围

- 影响模块：脚本入口、TypeScript 编译配置、测试配置、库构建配置。
- 影响对象：本地开发命令、CI 前置命令、后续源码构建产物。
- 行为变化：新增 `pnpm dev`、`pnpm test`、`pnpm build` 等工具命令；运行时代码行为未变化。
- 风险等级：中低；当前 Rollup 入口为空，会产生 empty chunk 警告，属于阶段 0 预期现象。

## 涉及文件

| 文件                                                                                | 动作 | 说明                                                      |
| ----------------------------------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `package.json`                                                                      | 修改 | 增加工具脚本，包名同步为 `solace`，保留 Node 版本约束     |
| `tsconfig.json`                                                                     | 修改 | 替换为严格 TypeScript 配置                                |
| `vitest.config.ts`                                                                  | 新增 | 配置 Vitest 使用 `jsdom` 环境，并允许引导阶段空测试集通过 |
| `rollup.config.mjs`                                                                 | 新增 | 配置 ESM、CJS 和 `.d.ts` 输出                             |
| `dist/**`                                                                           | 生成 | `pnpm build` 生成当前库构建产物                           |
| `solace-project-log/solace-entries/2026-07-10-002-build-test-tooling-configured.md` | 新增 | 记录本次工具链配置                                        |
| `solace-project-log/index.md`                                                       | 修改 | 追加本次变更索引                                          |
| `solace-project-log/solace-entries/2026-07-10-001-workspace-scaffold-created.md`    | 修改 | 将日志摘要中的旧临时名合并为正式项目名                    |

## 验证记录

| 验证项   | 命令或方式       | 结果                                                                                         |
| -------- | ---------------- | -------------------------------------------------------------------------------------------- |
| 类型检查 | `pnpm typecheck` | 通过，退出码为 0                                                                             |
| 测试命令 | `pnpm test`      | 通过，当前无测试文件，Vitest 以退出码 0 结束                                                 |
| 库构建   | `pnpm build`     | 通过，生成 `dist/index.js`、`dist/index.cjs`、`dist/index.d.ts`；空入口触发 empty chunk 警告 |

## 后续动作

- 继续执行阶段 0 Step 03，配置 ESLint、Prettier、CI 和质量门禁。
- 后续添加第一批真实测试后，评估移除 `passWithNoTests`。
