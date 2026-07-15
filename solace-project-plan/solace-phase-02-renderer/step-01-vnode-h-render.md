# Step 01：实现 VNode、h 与基础 render

## 目标

定义 VNode 结构并支持基础 DOM 挂载。

## 文件变更

- Create: `src/shared/flags.ts`
- Create: `src/vnode/vnode.ts`
- Create: `src/vnode/h.ts`
- Create: `src/renderer/dom.ts`
- Create: `src/renderer/renderer.ts`
- Modify: `src/index.ts`
- Create: `tests/unit/renderer/vnode-render.test.ts`

## 执行步骤

- [x] 测试 `h("div", null, "hello")` 创建元素 VNode。
- [x] 测试 `render(h("div", null, "hello"), container)` 插入 DOM。
- [x] 测试数组 children 能按顺序挂载。
- [x] 定义 `ShapeFlags`，区分 element、text children、array children。
- [x] 实现 `createVNode` 和 `h`。
- [x] 实现 DOM host ops：`createElement`、`insert`、`setText`、`remove`、`patchProp`。
- [x] 实现 `render`、`patch`、`mountElement`。

## 验证命令

```bash
pnpm test tests/unit/renderer/vnode-render.test.ts
pnpm typecheck
```

预期结果：基础挂载测试通过。
