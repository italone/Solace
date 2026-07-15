# 2026-07-10-029：补充 createApp 单元覆盖

## 基本信息

- 日期：2026-07-10
- 类型：测试 / 覆盖率
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

新增 `tests/unit/app/create-app.test.ts`，覆盖 `createApp` 挂载根函数组件和直接 VNode 两个公开用法。package exports 测试拆分后，`createApp` 不再只依赖发布入口测试覆盖。

## 变动原因

拆分 package exports 测试后，默认 coverage 不再包含 `tests/integration/package-exports.test.ts`，导致公开的 `src/app.ts` API 覆盖不足。`createApp` 是 package root 公共 API，应在默认单元测试集中直接覆盖。

## 影响范围

- 影响模块：app API tests、coverage。
- 影响对象：`createApp(rootComponent).mount(container)`。
- 行为变化：无运行时行为变化；默认测试数量从 69 增加到 71。
- 风险等级：低；仅新增测试。

## 涉及文件

| 文件                                                                           | 动作 | 说明                                            |
| ------------------------------------------------------------------------------ | ---- | ----------------------------------------------- |
| `tests/unit/app/create-app.test.ts`                                            | 新增 | 覆盖 root function component 和 root VNode 挂载 |
| `solace-project-log/solace-entries/2026-07-10-029-create-app-unit-coverage.md` | 新增 | 记录本次 app API 测试补充                       |
| `solace-project-log/index.md`                                                  | 修改 | 追加本次变更索引                                |

## 验证记录

| 验证项             | 命令或方式                                    | 结果                                                                                                   |
| ------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| createApp 定向测试 | `pnpm test tests/unit/app/create-app.test.ts` | 通过，1 个测试文件、2 个测试                                                                           |
| 覆盖率门禁         | `pnpm test:coverage`                          | 通过，14 个默认测试文件、71 个测试；statements 93.05%、branches 83.14%、functions 96.36%、lines 92.85% |
| 全量质量门禁       | `pnpm quality`                                | 通过，typecheck、JSX dev typecheck、lint、默认测试和 package exports 测试均通过                        |

## 后续动作

- 后续新增 package root 公共 API 时，应同步增加默认单元测试，而不是只依赖 package exports 测试。
