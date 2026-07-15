# Step 01：实现 scheduler 与 nextTick

## 目标

统一管理响应式更新任务，避免重复执行，并暴露 `nextTick`。

## 文件变更

- Create: `src/scheduler/scheduler.ts`
- Modify: `src/reactivity/effect.ts`
- Modify: `src/renderer/renderer.ts`
- Modify: `src/index.ts`
- Create: `tests/unit/scheduler/scheduler.test.ts`
- Create: `tests/integration/batched-render.test.ts`

## 执行步骤

- [x] 测试 `queueJob` 对同一个 job 去重。
- [x] 测试多个 job 按入队顺序执行。
- [x] 测试 `nextTick` 在任务 flush 后 resolve。
- [x] 测试同一 tick 内多次 state mutation 只更新一次 DOM。
- [x] 使用微任务实现 job queue。
- [x] 将组件 render effect 的 scheduler 改为 `queueJob`。
- [x] 从 `src/index.ts` 导出 `nextTick`。

## 验证命令

```bash
pnpm test tests/unit/scheduler/scheduler.test.ts
pnpm test tests/integration/batched-render.test.ts
pnpm typecheck
```

预期结果：调度和批处理渲染测试通过。
