# 2026-07-17-012：刷新 browser benchmark 趋势样本

## 基本信息

- 日期：2026-07-17
- 类型：browser benchmark / performance docs / project log
- 状态：已完成
- 关联提交：本条日志随趋势刷新提交一并提交

## 变动摘要

追加 5 条 Chromium production large-list benchmark 本地样本，并用最新 history summary 刷新性能文档中的 full-history 与 latest-window 趋势数据。

## 变动原因

上一轮 DevTools large-list recorder smoke 已补齐 payload 稳定性覆盖。继续推进性能工作前，需要先刷新 browser production benchmark 趋势，确认 10,000 行 large-list 的 initial render、selected-row update 和 unmount 数据仍有当前基准支撑。

## 影响范围

- 影响模块：browser benchmark history、性能文档、项目日志。
- 行为变化：无运行时代码变化；`.benchmark-history/browser.jsonl` 为本地 ignored 数据，不纳入提交。
- 风险等级：低；仅更新本地趋势记录与文档。

## 涉及文件

| 文件                                                                                  | 动作 | 说明                        |
| ------------------------------------------------------------------------------------- | ---- | --------------------------- |
| `docs/performance.md`                                                                 | 修改 | 刷新 browser history 趋势表 |
| `solace-project-log/solace-entries/2026-07-17-012-browser-benchmark-trend-refresh.md` | 新增 | 记录本次趋势刷新            |
| `solace-project-log/index.md`                                                         | 修改 | 追加 2026-07-17 日志索引    |

## 验证记录

| 验证项                    | 命令或方式                                                                                                                             | 结果                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Browser benchmark samples | `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=5 pnpm benchmark:browser` | 通过，5 samples；沙箱内首次因 `127.0.0.1:5177` listen EPERM，提升权限后通过 1 test |
| Full browser history      | `pnpm benchmark:history -- --min-browser-count 15 --json`                                                                              | 通过，browser records 17；median: 8.1 / 3.6 / 1.2 ms                               |
| Latest browser history    | `pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json`                                                      | 通过，latest browser records 5；median: 7.1 / 3.5 / 1.1 ms                         |
| 格式检查                  | `pnpm format:check`                                                                                                                    | 通过                                                                               |
| Diff whitespace           | `git diff --check`                                                                                                                     | 通过                                                                               |
| Private boundary          | `package.json`                                                                                                                         | 保持 `"private": true`                                                             |

## 后续动作

- 下一轮 runtime 性能优化应继续从 browser/latest-window 数据和 jsdom benchmark 场景中选择最窄热点切入，避免无基准支撑的微调。
