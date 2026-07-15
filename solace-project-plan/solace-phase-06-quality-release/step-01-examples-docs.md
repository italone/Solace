# Step 01：完善示例与文档

## 目标

让使用者可以从文档理解框架设计，并通过示例快速运行。

## 文件变更

- Modify: `readme.md`
- Modify: `docs/api.md`
- Modify: `docs/architecture.md`
- Modify: `docs/performance.md`
- Create: `examples/todo-app/`
- Create: `examples/large-list/`
- Create: `tests/e2e/todo-app.spec.ts`
- Create: `tests/e2e/large-list.spec.ts`

## 执行步骤

- [x] 更新 `readme.md`，把项目状态从方案文档调整为可运行框架说明。
- [x] 在 `docs/api.md` 记录公开 API、参数、返回值和示例。
- [x] 在 `docs/architecture.md` 记录响应式到渲染的完整数据流。
- [x] 在 `docs/performance.md` 记录基准测试方法，不写未验证结果。
- [x] 创建 todo 示例，覆盖列表新增、删除、切换状态。
- [x] 创建 large list 示例，覆盖 10,000 行渲染和局部更新。
- [x] 为两个示例编写 E2E 测试。

## 验证命令

```bash
pnpm test:e2e
pnpm typecheck
pnpm lint
```

预期结果：示例文档同步，E2E 测试通过。
