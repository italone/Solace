# 2026-07-29-001：实现 DevTools 浏览器扩展 timeline panel

## 基本信息

- 日期：2026-07-29
- 类型：DevTools extension / browser UI / Vite build / Playwright smoke / documentation
- 状态：已完成

## 变动摘要

新增 `examples/devtools-extension` 浏览器 DevTools 扩展示例，在不改变 runtime DevTools payload
的前提下，将 `@italone/solace/devtools` 的公开事件流接入一个本地 timeline panel。面板支持事件族过滤、
pause/resume、clear、详情查看和 capture limit，并通过 Playwright smoke 覆盖基础交互。

## 变动原因

此前 DevTools 已具备 listener 和 recorder 底层 API，但没有可视化面板，调试体验和生态展示仍停留在低层集成面。
本次实现把已有公开 API 产品化为第一个受控范围的浏览器 DevTools panel，同时继续保持隐私边界：只展示已序列化
`DevtoolsEvent`，不读取组件实例、DOM、VNode、props、store state、reactive target、action args/results 或用户内容。

## 影响范围

- `examples/devtools-extension` 新增 Manifest V3 扩展示例、DevTools page、content script、page bridge、background relay、panel transport 和 timeline UI。
- `package.json` 新增 DevTools extension 开发、构建和 e2e smoke scripts。
- `playwright.devtools-extension.config.ts` 新增扩展示例专用 Playwright server，避免普通
  `pnpm test:e2e` 依赖未构建的 extension preview。
- `src/devtools/events.ts` 安装非导出的 page-local DevTools hook，使 extension bridge 能以
  classic script 订阅 inspected page 的同一个 DevTools event bus。
- `tests/unit/devtools-extension/**`、`tests/integration/devtools-extension-bridge.test.ts` 和 `tests/e2e/devtools-extension.spec.ts` 覆盖 state、panel、transport、relay 和浏览器 smoke。
- DevTools、API、包使用、路线图、项目状态和 README 文档同步当前完成度。

## 涉及文件

| 文件                                                                        | 动作      | 说明                                              |
| --------------------------------------------------------------------------- | --------- | ------------------------------------------------- |
| `examples/devtools-extension/manifest.json`                                 | 新增/修改 | Manifest V3 扩展声明和 DevTools wiring            |
| `examples/devtools-extension/devtools.html`                                 | 新增      | DevTools page 入口                                |
| `examples/devtools-extension/panel.html`                                    | 新增      | panel HTML 入口                                   |
| `examples/devtools-extension/src/devtools-page.ts`                          | 新增      | 注册 Solace DevTools panel                        |
| `examples/devtools-extension/src/background.ts`                             | 新增/修改 | 按 tab 激活和转发 content script 与 panel 消息    |
| `examples/devtools-extension/src/content-script.ts`                         | 新增/修改 | 等待 tab-scoped activation 后注入 page bridge     |
| `examples/devtools-extension/src/bridge.ts`                                 | 新增/修改 | 通过 page-local hook 订阅并复制序列化事件         |
| `examples/devtools-extension/src/panel/state.ts`                            | 新增      | timeline state、filters、pause、clear、limit      |
| `examples/devtools-extension/src/panel/components.tsx`                      | 新增      | timeline、controls、details UI                    |
| `examples/devtools-extension/src/panel/main.tsx`                            | 新增/修改 | panel app root 和 event source 接入               |
| `examples/devtools-extension/src/panel/transport.ts`                        | 新增      | extension runtime transport 和本地 smoke fallback |
| `examples/devtools-extension/src/panel/styles.css`                          | 新增      | 面板样式                                          |
| `examples/devtools-extension/vite.config.ts`                                | 新增/修改 | extension 多入口构建和本地源码 alias              |
| `src/devtools/events.ts`                                                    | 修改      | 安装 page-local DevTools hook                     |
| `package.json`                                                              | 修改      | 新增 extension scripts                            |
| `playwright.config.ts`                                                      | 修改      | 保持普通 e2e 不依赖 extension preview             |
| `playwright.devtools-extension.config.ts`                                   | 新增      | DevTools extension 专用 e2e server 配置           |
| `tests/unit/devtools-extension/state.test.ts`                               | 新增      | state/filter/limit 单元覆盖                       |
| `tests/unit/devtools-extension/panel.test.ts`                               | 新增      | panel 渲染和隐私边界单元覆盖                      |
| `tests/unit/devtools-extension/transport.test.ts`                           | 新增      | panel transport 回归覆盖                          |
| `tests/integration/devtools-extension-bridge.test.ts`                       | 新增      | bridge/relay 集成覆盖                             |
| `tests/e2e/devtools-extension.spec.ts`                                      | 新增      | 浏览器 panel workflow smoke                       |
| `docs/api.md`                                                               | 修改      | 对齐 DevTools subpath 使用边界                    |
| `docs/api.zh-CN.md`                                                         | 修改      | 同步中文 API DevTools 边界                        |
| `docs/devtools.md`                                                          | 修改      | 记录扩展 panel scope、隐私边界和验证命令          |
| `docs/package-usage.md`                                                     | 修改      | 补充 extension example 使用说明                   |
| `docs/roadmap.md`                                                           | 修改      | 将 DevTools extension UI 更新为首个示例已实现     |
| `docs/project-status.md`                                                    | 修改      | 同步完成度和已知缺口                              |
| `docs/project-status.zh-CN.md`                                              | 修改      | 同步中文完成度和已知缺口                          |
| `readme.md`                                                                 | 修改      | 更新项目摘要、示例和路线图                        |
| `readme.zh-CN.md`                                                           | 修改      | 同步中文 README                                   |
| `solace-project-log/index.md`                                               | 修改      | 追加本日志索引                                    |
| `solace-project-log/solace-entries/2026-07-29-001-devtools-extension-ui.md` | 新增      | 本日志                                            |

## 验证记录

| 验证项                   | 命令                                                                                                                                                          | 结果   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Unit transport           | `pnpm vitest run tests/unit/devtools-extension/transport.test.ts`                                                                                             | 已通过 |
| Focused bridge/transport | `pnpm vitest run tests/unit/devtools-extension/transport.test.ts tests/integration/devtools-extension-bridge.test.ts`                                         | 已通过 |
| Focused DevTools tests   | `pnpm vitest run tests/unit/devtools-extension/state.test.ts tests/unit/devtools-extension/panel.test.ts tests/integration/devtools-extension-bridge.test.ts` | 已通过 |
| DevTools extension e2e   | `pnpm test:e2e:devtools-extension`                                                                                                                            | 已通过 |
| Browser e2e              | `pnpm test:e2e`                                                                                                                                               | 已通过 |
| Quality gate             | `pnpm quality`                                                                                                                                                | 已通过 |
| Extension build          | `pnpm build:devtools-extension`                                                                                                                               | 已通过 |

## 后续动作

- 后续如果要从示例升级为正式分发的浏览器扩展，需要单独设计扩展发布、权限收窄、手工浏览器 QA、图标资产和版本策略。
- component tree、dependency graph、flame chart、persisted captures、telemetry 和 SSR/SSG/hydration 专用 panels 仍需先设计对应 runtime event contracts。
