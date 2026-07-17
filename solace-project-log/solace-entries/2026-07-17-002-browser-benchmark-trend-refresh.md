# 2026-07-17-002：刷新 browser benchmark 趋势样本

## 基本信息

- 日期：2026-07-17
- 类型：browser benchmark / performance docs / project log
- 状态：已完成
- 关联提交：本条日志随文档更新提交一并提交

## 变动摘要

追加 5 条 Chromium production `large-list` benchmark 样本，并用 `--min-browser-count 10` 汇总本地 ignored
history。`docs/performance.md` 的 Latest Local Browser History Summary 从 7 条记录更新为 12 条记录。

## 变动原因

近期已经完成多轮 renderer keyed children、Fragment 和 batching 优化。继续扩大 runtime 优化前，需要先用更多
production browser 样本校准趋势，避免只依据 jsdom 或单次 browser 结果继续选择热点。

## 影响范围

- 影响模块：browser benchmark history、性能文档、项目日志。
- 行为变化：无运行时代码变化。
- 风险等级：低；仅更新文档和项目日志，`.benchmark-history/` 原始样本仍保持本地 ignored。

## 涉及文件

| 文件                                                                                  | 动作 | 说明                                 |
| ------------------------------------------------------------------------------------- | ---- | ------------------------------------ |
| `docs/performance.md`                                                                 | 修改 | 更新 12 样本 browser history summary |
| `solace-project-log/solace-entries/2026-07-17-002-browser-benchmark-trend-refresh.md` | 新增 | 记录本次趋势样本刷新                 |
| `solace-project-log/index.md`                                                         | 修改 | 追加 2026-07-17 日志索引             |

## 验证记录

| 验证项                    | 命令或方式                                                                                                                             | 结果                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Browser benchmark sandbox | `SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=5 SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl pnpm benchmark:browser` | 沙箱内失败，Vite preview 监听 `127.0.0.1:5177` 返回 `EPERM`         |
| Browser benchmark samples | `SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=5 SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl pnpm benchmark:browser` | 提升权限后通过，1 个 Playwright 测试通过，写入 5 条 browser summary |
| Browser history gate      | `pnpm benchmark:history -- --min-browser-count 10 --json`                                                                              | 通过，browser `large-list` 记录数 12；median: 11.0 / 4.55 / 1.25 ms |
| 格式检查                  | `pnpm format:check`                                                                                                                    | 通过                                                                |
| Diff whitespace           | `git diff --check`                                                                                                                     | 通过                                                                |

## 后续动作

- 下一轮 runtime 优化应优先结合 12 样本 browser trend 判断，而不是只依据 jsdom benchmark。
- 如果继续做 renderer 性能，优先观察 `updateMs` 的 p95 是否在新增样本中持续偏高；如果只是旧慢样本主导 p95，应先继续积累样本或改进趋势报告。
