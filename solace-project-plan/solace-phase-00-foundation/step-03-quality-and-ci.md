# Step 03：配置代码质量与 CI

## 目标

建立统一格式、静态检查和持续集成门禁。

## 文件变更

- Modify: `package.json`
- Create: `eslint.config.js`
- Create: `.prettierrc`
- Create: `.github/workflows/ci.yml`

## 执行步骤

- [x] 安装质量工具：

```bash
pnpm add -D eslint prettier typescript-eslint husky lint-staged
```

- [x] 增加脚本：

```json
{
  "scripts": {
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "quality": "pnpm format:check && pnpm typecheck && pnpm typecheck:jsxdev && pnpm lint && pnpm test && pnpm test:package"
  }
}
```

- [x] 配置 Prettier：

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [x] 配置 CI 执行 `pnpm install`、`pnpm format:check`、`pnpm typecheck`、`pnpm typecheck:jsxdev`、`pnpm lint`、`pnpm test`、`pnpm test:package`、`pnpm build`。

## 验证命令

```bash
pnpm quality
```

预期结果：质量门禁一次性通过。
