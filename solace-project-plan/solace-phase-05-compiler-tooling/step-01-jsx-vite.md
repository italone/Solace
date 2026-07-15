# Step 01：接入 JSX 与 Vite 示例

## 目标

提供可运行示例，验证框架 API 的真实使用体验。

## 文件变更

- Create: `examples/basic-counter/index.html`
- Create: `examples/basic-counter/src/main.tsx`
- Create: `examples/basic-counter/vite.config.ts`
- Create: `src/jsx-runtime.ts`
- Create: `src/jsx-dev-runtime.ts`
- Create: `playwright.config.ts`
- Modify: `package.json`
- Modify: `vitest.config.ts`
- Modify: `tsconfig.json`
- Create: `tests/e2e/basic-counter.spec.ts`

## 执行步骤

- [x] 配置 TypeScript JSX 入口为 `src/jsx-runtime.ts`。
- [x] 实现 JSX runtime 的 `jsx`、`jsxs`、`Fragment` 到 `h` 的映射。
- [x] 创建 basic counter 示例，使用 `reactive`、`h` 或 JSX 渲染按钮。
- [x] 编写 Playwright 测试：打开页面、点击按钮、断言计数变化。
- [x] 确认示例不依赖未公开内部模块。

## 验证命令

```bash
pnpm dev
pnpm test:e2e
pnpm typecheck
```

预期结果：示例可启动，浏览器交互测试通过。
