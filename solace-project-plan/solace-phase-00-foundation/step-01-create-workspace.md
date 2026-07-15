# Step 01：创建项目工作区

## 目标

创建基础 Node/TypeScript 项目结构，为后续源码、测试、示例和文档提供固定位置。

## 文件变更

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/index.ts`
- Create: `tests/unit/.gitkeep`
- Create: `tests/integration/.gitkeep`
- Create: `tests/e2e/.gitkeep`
- Create: `tests/performance/.gitkeep`
- Create: `examples/basic-counter/.gitkeep`
- Create: `docs/architecture.md`
- Create: `docs/api.md`
- Create: `docs/performance.md`

## 执行步骤

- [x] 初始化包信息：`pnpm init`
- [x] 安装基础依赖：

```bash
pnpm add -D typescript vite vitest jsdom @vitest/coverage-v8
pnpm add -D rollup @rollup/plugin-node-resolve @rollup/plugin-commonjs rollup-plugin-dts
```

- [x] 创建源码、测试、示例和文档目录。
- [x] 在 `src/index.ts` 写入首个空导出，保证 TypeScript 能识别入口：

```ts
export {};
```

- [x] 配置 `package.json` 的基础字段：

```json
{
  "name": "solace",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
```

## 验证命令

```bash
pnpm tsc --init
pnpm typecheck
```

预期结果：`pnpm typecheck` 退出码为 0。
