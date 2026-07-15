# 2026-07-13-001：对齐文档当前状态说明

## 基本信息

- 日期：2026-07-13
- 类型：文档
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

更新 `readme.md` 的“后续建议”章节，移除仍停留在项目初始化前的“创建最小项目骨架”建议，并替换为当前框架闭环完成后的演进方向。同时同步 README 当前 package root 公共 API、`docs/performance.md` 的最新本地 benchmark 日期和运行环境，补充 `docs/package-usage.md` 对当前私有包状态的安装说明，让 package smoke 覆盖公开类型导入，并补齐 API 文档示例的必要导入。

## 变动原因

项目已经具备响应式核心、渲染器、组件、事件、store、JSX runtime、示例、文档和发布前门禁。继续保留初始化阶段建议会误导后续执行者；README 的当前 public API 应和 `src/index.ts` 保持一致；性能文档也应反映 2026-07-13 的最新 benchmark 验证。由于 `package.json` 仍保留 `"private": true`，包使用文档也需要避免让读者误以为当前已经可以从 registry 安装。API 文档使用了公开类型示例，发布前 smoke 应同步验证这些类型能从包根导入；示例代码块也应包含必要导入，方便复制到严格 TypeScript consumer 中验证。

## 影响范围

- 影响模块：README 文档、性能文档、包使用文档、API 文档、package smoke 脚本。
- 影响对象：后续建议、项目当前状态说明、README public API 列表、本地 benchmark 记录、安装说明、公开类型导入验证、API 示例可复制性。
- 行为变化：无运行时行为变化。
- 风险等级：低；仅调整文档内容。

## 涉及文件

| 文件                                                                             | 动作 | 说明                                                                                         |
| -------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------- |
| `readme.md`                                                                      | 修改 | 将后续建议从初始化工作改为性能基准、候选能力评估和发布策略，并同步当前 package root 公共 API |
| `docs/api.md`                                                                    | 修改 | 补充公开 TypeScript 类型说明、示例类型导入和运行时导入，并执行 Prettier 格式化               |
| `docs/performance.md`                                                            | 修改 | 同步最新本地 benchmark 日期和环境，并执行 Prettier 格式化                                    |
| `docs/package-usage.md`                                                          | 修改 | 说明当前私有包状态下 registry 安装只适用于发布后                                             |
| `scripts/package-consumer-smoke.mjs`                                             | 修改 | 在临时 consumer TSX 中验证公开类型从包根导入                                                 |
| `solace-project-log/solace-entries/2026-07-13-001-readme-next-step-alignment.md` | 新增 | 记录本次 README 文档对齐，并执行 Prettier 格式化                                             |
| `solace-project-log/index.md`                                                    | 修改 | 追加本次变更索引，并执行 Prettier 格式化                                                     |

## 验证记录

| 验证项                   | 命令或方式                      | 结果                                                                                                                               |
| ------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 过期说明扫描             | `rg` 扫描旧初始化说明和旧草案词 | 通过，未发现过期描述                                                                                                               |
| README 新建议检查        | `rg` 扫描 README 新后续建议     | 通过，新后续建议可检索                                                                                                             |
| README public API 检查   | `rg` 扫描 README root API 列表  | 通过，当前 root API 和候选能力说明可检索                                                                                           |
| API 类型说明检查         | `rg` 扫描 API 公开类型说明      | 通过，公开类型说明和示例导入可检索                                                                                                 |
| API 示例导入检查         | `rg` 扫描 API 示例导入          | 通过，组件和 store 示例的运行时导入与精确 context 类型可检索                                                                       |
| 包安装说明检查           | `rg` 扫描私有包安装说明         | 通过，私有包状态和发布后安装说明可检索                                                                                             |
| Typecheck                | `pnpm typecheck`                | 通过                                                                                                                               |
| Lint                     | `pnpm lint`                     | 通过                                                                                                                               |
| Format check             | `pnpm exec prettier --check`    | 初次检查发现 4 个文件格式漂移；执行 `pnpm exec prettier --write` 修复后复查通过，最终复查所有匹配文件均符合 Prettier 风格          |
| Unit / integration tests | `pnpm test`                     | 通过，14 个测试文件、71 个测试通过                                                                                                 |
| Benchmark                | `pnpm benchmark`                | 通过，3 个测试文件、3 个测试通过                                                                                                   |
| Package consumer smoke   | `pnpm package:smoke`            | 先失败于 fixture props 类型缺少 `onChange`，修正后通过；最终复查 tarball 消费、公开类型导入、TSX typecheck、ESM/CJS 入口验证均通过 |
| Release gate             | `pnpm release:check`            | 通过，quality、coverage、package smoke、benchmark 和 Playwright e2e 均通过                                                         |

## 后续动作

- 后续如果新增真实浏览器 benchmark 或发布策略变更，应继续同步 README、性能文档和 release 文档。
