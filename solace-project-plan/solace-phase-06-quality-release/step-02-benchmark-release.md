# Step 02：建立性能基准与 alpha 发布流程

## 目标

用可复现数据验证性能目标，并准备首个 alpha 版本。

## 文件变更

- Create: `tests/performance/render.bench.ts`
- Create: `tests/performance/list-diff.bench.ts`
- Create: `tests/performance/memory.bench.ts`
- Modify: `docs/performance.md`
- Create: `.changeset/initial-alpha.md`

## 执行步骤

- [x] 安装 benchmark 工具：

```bash
pnpm add -D tinybench
```

- [x] 创建 1,000 组件首次渲染基准。
- [x] 创建 10,000 行列表创建、更新、删除基准。
- [x] 创建 keyed diff 重排基准。
- [x] 创建组件反复挂载、卸载的内存观察基准。
- [x] 在 `docs/performance.md` 写入机器环境、命令、结果表和结论。
- [x] 如果目标未达成，记录未达成项和下一轮优化方向。
- [x] 创建 Changesets 记录，版本类型为 prerelease 或 patch。

## 验证命令

```bash
pnpm benchmark
pnpm release:check
```

预期结果：性能命令可重复运行，完整发布前门禁通过，发布记录完整。
