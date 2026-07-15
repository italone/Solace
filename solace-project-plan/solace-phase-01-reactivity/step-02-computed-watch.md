# Step 02：实现 computed、ref 与 watch

## 目标

补齐派生状态和监听能力，为组件渲染更新做准备。

## 文件变更

- Create: `src/reactivity/computed.ts`
- Create: `src/reactivity/ref.ts`
- Create: `src/reactivity/watch.ts`
- Modify: `src/reactivity/effect.ts`
- Modify: `src/index.ts`
- Create: `tests/unit/reactivity/computed-watch.test.ts`

## 执行步骤

- [x] 测试 `computed` 首次读取时执行 getter。
- [x] 测试依赖未变化时 `computed` 重复读取返回缓存。
- [x] 测试依赖变化后 `computed` 下次读取重新计算。
- [x] 测试 `ref(1).value` 能被 `effect` 跟踪。
- [x] 测试 `watch(source, callback)` 返回新值和旧值。
- [x] 给 `ReactiveEffect` 增加 `scheduler` 参数。
- [x] 实现 `computed` 的 dirty 标记和懒执行。
- [x] 实现 `ref` 的 `.value` 访问和触发。
- [x] 实现 `watch` 的 source getter、旧值缓存和停止监听函数。

## 验证命令

```bash
pnpm test tests/unit/reactivity/computed-watch.test.ts
pnpm test tests/unit/reactivity
pnpm typecheck
```

预期结果：响应式测试全部通过。
