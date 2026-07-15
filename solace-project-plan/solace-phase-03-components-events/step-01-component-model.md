# Step 01：实现组件实例模型

## 目标

让 renderer 支持组件 VNode，并维护组件实例状态。

## 文件变更

- Create: `src/component/component.ts`
- Create: `src/component/props.ts`
- Modify: `src/renderer/diff.ts`
- Modify: `src/shared/flags.ts`
- Modify: `src/index.ts`
- Create: `tests/unit/component/component.test.ts`

## 执行步骤

- [x] 测试函数式组件返回 render 函数后可挂载。
- [x] 测试 props 能传入组件。
- [x] 测试 props 变化后组件重新渲染。
- [x] 定义 `ComponentInstance`，包含 vnode、type、props、setupState、subTree、isMounted。
- [x] 实现 `createComponentInstance`。
- [x] 实现 `setupComponent` 和 props 初始化。
- [x] 在 renderer patch 流程中增加组件分支、`mountComponent`、`updateComponent`。

## 验证命令

```bash
pnpm test tests/unit/component/component.test.ts
pnpm typecheck
```

预期结果：组件挂载和 props 更新测试通过。
