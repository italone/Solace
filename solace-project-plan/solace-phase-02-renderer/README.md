# 阶段 2：VNode 与渲染器

## 目标

把响应式状态和 DOM 更新连接起来，实现最小渲染闭环。

## 执行文件

1. [`step-01-vnode-h-render.md`](./step-01-vnode-h-render.md)
2. [`step-02-dom-renderer-diff.md`](./step-02-dom-renderer-diff.md)

## 阶段验收

- `h()` 能创建 VNode。
- `render()` 能挂载元素、文本和子节点。
- 状态变化能触发 DOM patch。
- keyed children 的新增、删除、移动有测试覆盖。
