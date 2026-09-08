# SSR Hang Guard（timeoutMs）设计（2026-09-08）

## 背景与问题

2026-09-08 的 SSR async 边界审计发现：一个永不 settle 的 promise（组件 render 返回 pending promise、async loader 挂死）会永久挂死所有 async SSR 入口——`renderToStringAsync` 的 `prepareAsyncSource`（`src/shared/async-tree.ts:114-115`）、`renderToStream` 的主循环 await（`src/server/render-to-stream.ts:168`），以及最严重的 out-of-order `racePending`（`render-to-stream.ts:431-437`，永久 await `boundary.ready`，连带卡死 `flushPendingBoundaries` 和 `generateStaticSiteAsync` 的路由循环 `generate-static-site.ts:112`）。当前无任何运行时防护。

## 方案（用户已确认的决策）

### API（opt-in，默认无超时，零破坏）

- **`renderToStringAsync(source, { timeoutMs })`**：整个渲染超时 → rejected promise，错误为新的 `SolaceTimeoutError`。
- **`generateStaticSiteAsync({ timeoutMs, routes: [{ timeoutMs? }] })`**：site 级 `timeoutMs` 应用于每个 route 的渲染；route 级 `timeoutMs` 覆盖 site 级。触发时整个 build reject（与既有"单路由失败拒整 build"语义一致）。
- **`renderToStream(source, { timeoutMs })`**：
  - **ordered 模式**：主生产循环（含 inline loader await）超时 → `controller.error(SolaceTimeoutError)`。
  - **out-of-order 模式**：每个 pending boundary 的 `ready` 超时 → 发射失败注释（`failed:` 消息标注 timeout）+ 保留 fallback，stream 继续并正常 close（与 loader 失败 / 子树渲染失败的既有语义一致）；只有主文档流（boundary flush 之前的 source 阶段）超时才 error stream。
- 同步 `renderToString` 不涉及（无 await）。

### 错误类型

根入口导出 `class SolaceTimeoutError extends Error`（`name: "SolaceTimeoutError"`），消息含触发超时的阶段标签与 `timeoutMs` 值（例如 `SSR render timed out after 100ms (awaiting boundary)`）。与 `SolaceHydrationError` 同样的导出模式。

### 实现要点

- 共享工具 `raceWithTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T>`（放在 `src/shared/` 或 `src/server/` 内部）：`Promise.race([promise, timerRejected])`，落败方 timer 必须清理（`clearTimeout`），避免悬挂 timer 或进程滞留。
- `renderToStream` out-of-order：`racePending` 改为对每个 boundary 的 `ready` 叠加 deadline（剩余时间按进入 flush 时刻计算），超时的 boundary 标记 `error = SolaceTimeoutError`，走既有 `winner.error !== null` 失败注释路径（消息经 `escapeHtml`，注释注入安全已有测试锁定）。
- 选项校验沿用现有模式：`timeoutMs` 必须为正有限 number，否则 `TypeError("SSR timeoutMs must be a positive number")`（各入口用一致措辞，含 SSG 的 route 级）；未知字段拒绝列表同步加入 `timeoutMs`。
- 计时起点：每个入口从**开始处理 source**起算整段时间（renderToStringAsync / renderToStream ordered / SSG 每 route 各自起算）；out-of-order boundary 从 boundary 创建（进入 pending）起算。

### 文档与契约同步

公共 API 变更需同步（沿用 frozen-contract 流程）：README/api.md（中英）新增 `timeoutMs` 与 `SolaceTimeoutError`、package-exports / public-contract 检查清单、changeset（minor 或 patch 由发布时 pre-mode 决定）、docs/project-status 能力描述。

## 测试计划

- 三个入口各一个 never-settling promise（`new Promise(() => {})`）+ 短 `timeoutMs`（fake timers 或 10–20ms 实时）：断言 reject / stream error / 失败注释 + fallback 保留 + stream 正常 close。
- 错误类型：`instanceof SolaceTimeoutError`、`error.name`。
- 不传 `timeoutMs` 时 never-settling 场景仍然挂起（用可控 gate promise 验证"未超时路径不引入计时行为"，避免测试本身挂死——gate 在断言后手动 release）。
- SSG：site 级生效、route 级覆盖 site 级。
- 校验：`timeoutMs: 0 / -1 / "x"` → TypeError；未知选项字段拒绝仍然工作。
- 无 timer 泄漏：超时后 promise 落败方不产生未处理 rejection / 进程滞留（vitest 默认会报 unhandled rejection，测试通过即覆盖）。

## 约束

- 不改任何默认行为；不传选项时字节级等价。
- 不引入 AbortSignal（用户已决策：仅 timeoutMs，保持 API 面小）。
- 遵守公共契约冻结流程与中英文档同步规则。

## 成功标准

所有新测试通过 + `pnpm quality` / `pnpm release:check` 绿；文档与契约检查同步更新；不传 `timeoutMs` 的全部既有测试零改动通过。
