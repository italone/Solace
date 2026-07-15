# Step 02：配置构建与测试工具

## 目标

让项目具备类型检查、单元测试、库构建和本地开发脚本。

## 文件变更

- Modify: `package.json`
- Modify: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `rollup.config.mjs`

## 执行步骤

- [x] 在 `package.json` 写入脚本：

```json
{
  "scripts": {
    "dev": "vite examples/basic-counter",
    "build": "rollup -c",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "benchmark": "vitest run --config vitest.benchmark.config.ts"
  }
}
```

- [x] 将 `tsconfig.json` 调整为严格模式：

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "skipLibCheck": true
  },
  "include": ["src", "tests", "examples", "*.ts"]
}
```

- [x] 创建 `vitest.config.ts`，环境使用 `jsdom`。
- [x] 创建 `rollup.config.mjs`，输出 ESM、CJS 和 `.d.ts`。

## 验证命令

```bash
pnpm typecheck
pnpm test
pnpm build
```

预期结果：三个命令均退出码为 0；如果还没有测试，Vitest 应能正常启动并报告无失败用例。
