# Step 01：实现 reactive 与 effect

## 目标

建立响应式系统的依赖收集和触发机制。

## 文件变更

- Create: `src/reactivity/effect.ts`
- Create: `src/reactivity/reactive.ts`
- Create: `src/shared/utils.ts`
- Modify: `src/index.ts`
- Create: `tests/unit/reactivity/reactive-effect.test.ts`

## 执行步骤

- [x] 先写测试：对象属性读取会被 `effect` 收集。
- [x] 先写测试：对象属性写入会重新执行对应 `effect`。
- [x] 先写测试：同值赋值不重复触发。
- [x] 实现 `targetMap: WeakMap<object, Map<PropertyKey, Set<ReactiveEffect>>>`。
- [x] 实现 `track(target, key)` 和 `trigger(target, key)`。
- [x] 实现 `effect(fn)`，返回 runner 函数。
- [x] 实现 `reactive(object)`，使用 `Proxy` 拦截 `get` 和 `set`。
- [x] 从 `src/index.ts` 导出 `reactive` 和 `effect`。

## 验证命令

```bash
pnpm test tests/unit/reactivity/reactive-effect.test.ts
pnpm typecheck
```

预期结果：响应式基础测试通过，类型检查通过。
