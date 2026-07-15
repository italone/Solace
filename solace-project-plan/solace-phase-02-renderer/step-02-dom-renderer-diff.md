# Step 02：实现 DOM patch 与 children diff

## 目标

支持元素更新、属性更新、文本更新、数组 children 更新和 keyed diff。

## 文件变更

- Create: `src/renderer/diff.ts`
- Modify: `src/renderer/renderer.ts`
- Modify: `src/vnode/vnode.ts`
- Create: `tests/unit/renderer/diff.test.ts`
- Create: `tests/integration/reactive-render.test.ts`

## 执行步骤

- [x] 测试相同元素类型更新 props。
- [x] 测试文本 children 更新。
- [x] 测试数组 children 新增和删除。
- [x] 测试 keyed children 移动时复用已有 DOM。
- [x] 实现 `patchElement` 和 `patchProps`。
- [x] 实现 non-keyed children 顺序 patch。
- [x] 实现 keyed children 的前缀、后缀、挂载、卸载和移动处理。
- [x] 接入响应式 `effect`，让 state mutation 触发重新 render。

## 验证命令

```bash
pnpm test tests/unit/renderer/diff.test.ts
pnpm test tests/integration/reactive-render.test.ts
pnpm typecheck
```

预期结果：DOM 更新和响应式渲染集成测试通过。
