# Step 02：实现轻量 store

## 目标

提供集中式状态管理能力，与响应式系统复用同一依赖追踪机制。

## 文件变更

- Create: `src/store/store.ts`
- Modify: `src/index.ts`
- Create: `tests/unit/store/store.test.ts`
- Create: `tests/integration/store-component.test.ts`

## 执行步骤

- [x] 测试 `createStore({ state, actions })` 返回响应式 state。
- [x] 测试 action 可以修改 state。
- [x] 测试组件读取 store state 后能响应更新。
- [x] 测试派生 getter 能缓存并在依赖变化后失效。
- [x] 实现 `createStore`，内部使用 `reactive` 和 `computed`。
- [x] 约束 action 的 `this` 或上下文参数，避免隐式全局状态。
- [x] 从 `src/index.ts` 导出 `createStore`。

## 验证命令

```bash
pnpm test tests/unit/store/store.test.ts
pnpm test tests/integration/store-component.test.ts
pnpm typecheck
```

预期结果：store 单测和组件集成测试通过。
