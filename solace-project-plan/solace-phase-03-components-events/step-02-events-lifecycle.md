# Step 02：实现事件与生命周期

## 目标

补齐 DOM 事件绑定、组件 emit、生命周期钩子和卸载清理。

## 文件变更

- Create: `src/event/event.ts`
- Create: `src/event/modifiers.ts`
- Create: `src/component/lifecycle.ts`
- Modify: `src/component/component.ts`
- Modify: `src/renderer/diff.ts`
- Modify: `src/renderer/dom.ts`
- Modify: `src/vnode/vnode.ts`
- Modify: `src/index.ts`
- Create: `tests/unit/event/event.test.ts`
- Create: `tests/unit/component/lifecycle.test.ts`

## 执行步骤

- [x] 测试 `onClick` 可以绑定并触发 DOM 事件。
- [x] 测试事件处理函数变更后只触发最新函数。
- [x] 测试事件卸载后不再触发。
- [x] 测试组件 `emit("change")` 能调用父级 `onChange`。
- [x] 测试 `mount`、`update`、`unmount` 生命周期顺序。
- [x] 实现事件 invoker 缓存，避免重复 add/remove listener。
- [x] 实现 `emit` 事件名到 props 监听器的映射。
- [x] 实现生命周期注册和调用。
- [x] 在 unmount 时清理事件、组件 effect 和子树。

## 验证命令

```bash
pnpm test tests/unit/event/event.test.ts
pnpm test tests/unit/component/lifecycle.test.ts
pnpm typecheck
```

预期结果：事件与生命周期测试通过。
