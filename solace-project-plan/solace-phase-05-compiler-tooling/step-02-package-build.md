# Step 02：配置包构建与导出

## 目标

生成可被外部项目消费的库产物。

## 文件变更

- Modify: `package.json`
- Modify: `rollup.config.mjs`
- Create: `docs/package-usage.md`
- Create: `tests/integration/package-exports.test.ts`

## 执行步骤

- [x] 配置 `exports`，暴露根入口和 JSX runtime。
- [x] 配置 Rollup 输出 `dist/index.js`、`dist/index.cjs`、`dist/index.d.ts`。
- [x] 测试包导出包含 `createApp`、`h`、`render`、`reactive`、`computed`、`nextTick`。
- [x] 写 `docs/package-usage.md`，包含安装、导入和最小示例。
- [x] 确认内部路径没有被文档推荐为公共 API。

## 验证命令

```bash
pnpm test:package
pnpm typecheck
```

预期结果：dist 产物存在，包导出测试通过。
