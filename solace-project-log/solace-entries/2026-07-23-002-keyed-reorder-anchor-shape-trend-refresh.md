# 2026-07-23-002：刷新 keyed reorder anchor optimization 与 shape matrix 趋势

## 基本信息

- 日期：2026-07-23
- 类型：browser benchmark / performance trend / project log
- 状态：已完成

## 变动摘要

在 anchor-node optimization 与 keyed-reorder shape matrix 扩展后，重新运行五次样本的浏览器 benchmark，
使用 `pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json`
汇总最新窗口，并更新性能文档与项目日志。

## 变动原因

需要新的趋势数据验证 keyed reorder 优化在所有 shape 上均将 `movePathCounts.anchorLookups` 降为 0，
并量化每种重排分布下的 DOM 操作数。

## 影响范围

- `docs/performance.md` 的 Latest Local Browser History Summary 小节。
- 本地 ignored 历史 `.benchmark-history/browser.jsonl`。
- 项目日志索引与条目。

## 涉及文件

| 文件                                                                                           | 动作 | 说明                                        |
| ---------------------------------------------------------------------------------------------- | ---- | ------------------------------------------- |
| `docs/performance.md`                                                                          | 修改 | 替换为 anchor optimization 后的最新窗口汇总 |
| `.benchmark-history/browser.jsonl`                                                             | 追加 | 本地 ignored，5 样本/浏览器场景             |
| `solace-project-log/index.md`                                                                  | 修改 | 追加 002 索引行                             |
| `solace-project-log/solace-entries/2026-07-23-002-keyed-reorder-anchor-shape-trend-refresh.md` | 新增 | 本日志                                      |

## 验证记录

| 验证项              | 命令                                                                                                                                   | 结果 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Browser benchmark   | `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=5 pnpm benchmark:browser` | 通过 |
| History summary     | `pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json`                                                      | 通过 |
| Renderer diff tests | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                                                                     | 通过 |
| History tests       | `pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts tests/unit/scripts/benchmark-history-summary.test.ts`            | 通过 |
| Type check          | `pnpm typecheck`                                                                                                                       | 通过 |
| Lint                | `pnpm lint`                                                                                                                            | 通过 |
| Format check        | `pnpm format:check`                                                                                                                    | 通过 |
| Whitespace check    | `git diff --check`                                                                                                                     | 通过 |

## 后续动作

- 无。

## Raw summary

```json
{
  "recordCount": 39,
  "groups": [
    {
      "kind": "jsdom-benchmark",
      "environment": "jsdom",
      "recordCount": 4,
      "metrics": {}
    },
    {
      "kind": "jsdom-benchmark",
      "environment": "jsdom",
      "task": "component mount/unmount loop",
      "recordCount": 4,
      "metrics": {
        "latencyMeanMs": {
          "count": 4,
          "median": 3.7214680333333057,
          "p95": 4.5322666000000025,
          "variance": 0.21042730005279925
        },
        "latencyP99Ms": {
          "count": 4,
          "median": 9.332265775000021,
          "p95": 10.829835320000065,
          "variance": 1.3399877251823957
        },
        "throughputMeanOpsPerSec": {
          "count": 4,
          "median": 357.4993120549351,
          "p95": 416.5586208695208,
          "variance": 2478.4246598046248
        }
      }
    },
    {
      "kind": "jsdom-benchmark",
      "environment": "jsdom",
      "task": "1000 component initial render",
      "recordCount": 4,
      "metrics": {
        "latencyMeanMs": {
          "count": 4,
          "median": 22.640646000000004,
          "p95": 26.60187499999995,
          "variance": 9.67264287890448
        },
        "latencyP99Ms": {
          "count": 4,
          "median": 22.863191754999963,
          "p95": 26.60187499999995,
          "variance": 8.226120778737034
        },
        "throughputMeanOpsPerSec": {
          "count": 4,
          "median": 44.75464301437273,
          "p95": 51.36593052320063,
          "variance": 36.856124255056116
        }
      }
    },
    {
      "kind": "jsdom-benchmark",
      "environment": "jsdom",
      "task": "1000 component batched reactive update",
      "recordCount": 4,
      "metrics": {
        "latencyMeanMs": {
          "count": 4,
          "median": 50.891062999999974,
          "p95": 56.233834,
          "variance": 38.512956161450454
        },
        "latencyP99Ms": {
          "count": 4,
          "median": 50.891062999999974,
          "p95": 56.233834,
          "variance": 38.512956161450454
        },
        "throughputMeanOpsPerSec": {
          "count": 4,
          "median": 19.649955388203068,
          "p95": 25.47359683340772,
          "variance": 8.373153589802866
        }
      }
    },
    {
      "kind": "jsdom-benchmark",
      "environment": "jsdom",
      "task": "1000 stable child components parent update",
      "recordCount": 4,
      "metrics": {
        "latencyMeanMs": {
          "count": 4,
          "median": 25.441749500000014,
          "p95": 28.56579099999999,
          "variance": 16.99632953082815
        },
        "latencyP99Ms": {
          "count": 4,
          "median": 25.441749500000014,
          "p95": 28.56579099999999,
          "variance": 14.848297778198239
        },
        "throughputMeanOpsPerSec": {
          "count": 4,
          "median": 39.31495778800894,
          "p95": 57.384071572445364,
          "variance": 74.61405921894561
        }
      }
    },
    {
      "kind": "jsdom-benchmark",
      "environment": "jsdom",
      "task": "5000 Fragment child initial render",
      "recordCount": 4,
      "metrics": {
        "latencyMeanMs": {
          "count": 4,
          "median": 32.717895999999996,
          "p95": 33.40704100000005,
          "variance": 0.3013749751877063
        },
        "latencyP99Ms": {
          "count": 4,
          "median": 32.717895999999996,
          "p95": 33.40704100000005,
          "variance": 0.3013749751877063
        },
        "throughputMeanOpsPerSec": {
          "count": 4,
          "median": 30.56682536301789,
          "p95": 31.276716180002,
          "variance": 0.2641982078533297
        }
      }
    },
    {
      "kind": "jsdom-benchmark",
      "environment": "jsdom",
      "task": "5000 Fragment child local text patch",
      "recordCount": 4,
      "metrics": {
        "latencyMeanMs": {
          "count": 4,
          "median": 30.86066699999992,
          "p95": 31.64145899999994,
          "variance": 0.1995681720306618
        },
        "latencyP99Ms": {
          "count": 4,
          "median": 30.86066699999992,
          "p95": 31.64145899999994,
          "variance": 0.1995681720306618
        },
        "throughputMeanOpsPerSec": {
          "count": 4,
          "median": 32.40472594473487,
          "p95": 32.834612777799634,
          "variance": 0.2143740685748959
        }
      }
    },
    {
      "kind": "jsdom-benchmark",
      "environment": "jsdom",
      "task": "5000 Fragment child middle insert",
      "recordCount": 4,
      "metrics": {
        "latencyMeanMs": {
          "count": 4,
          "median": 29.101166499999977,
          "p95": 29.348458999999934,
          "variance": 0.10377871745066142
        },
        "latencyP99Ms": {
          "count": 4,
          "median": 29.101166499999977,
          "p95": 29.348458999999934,
          "variance": 0.10377871745066142
        },
        "throughputMeanOpsPerSec": {
          "count": 4,
          "median": 34.36515016071749,
          "p95": 34.97502241286866,
          "variance": 0.14689537014954368
        }
      }
    },
    {
      "kind": "jsdom-benchmark",
      "environment": "jsdom",
      "task": "10000 row create",
      "recordCount": 4,
      "metrics": {
        "latencyMeanMs": {
          "count": 4,
          "median": 45.79966650000006,
          "p95": 46.19816700000001,
          "variance": 0.07997186416417175
        },
        "latencyP99Ms": {
          "count": 4,
          "median": 45.79966650000006,
          "p95": 46.19816700000001,
          "variance": 0.07997186416417175
        },
        "throughputMeanOpsPerSec": {
          "count": 4,
          "median": 21.834708031168123,
          "p95": 21.962555512006116,
          "variance": 0.01809444481210352
        }
      }
    },
    {
      "kind": "jsdom-benchmark",
      "environment": "jsdom",
      "task": "10000 row text to keyed list",
      "recordCount": 4,
      "metrics": {
        "latencyMeanMs": {
          "count": 4,
          "median": 50.59433349999995,
          "p95": 51.01625000000013,
          "variance": 0.08121386972925813
        },
        "latencyP99Ms": {
          "count": 4,
          "median": 50.59433349999995,
          "p95": 51.01625000000013,
          "variance": 0.08121386972925813
        },
        "throughputMeanOpsPerSec": {
          "count": 4,
          "median": 19.765100739547705,
          "p95": 19.910601399715354,
          "variance": 0.012365573629399796
        }
      }
    },
    {
      "kind": "jsdom-benchmark",
      "environment": "jsdom",
      "task": "10000 row local text update",
      "recordCount": 4,
      "metrics": {
        "latencyMeanMs": {
          "count": 4,
          "median": 51.748770499999864,
          "p95": 59.73075000000017,
          "variance": 21.00383230185622
        },
        "latencyP99Ms": {
          "count": 4,
          "median": 51.748770499999864,
          "p95": 59.73075000000017,
          "variance": 21.00383230185622
        },
        "throughputMeanOpsPerSec": {
          "count": 4,
          "median": 19.371888815934255,
          "p95": 20.719931421999885,
          "variance": 2.5435074202052634
        }
      }
    },
    {
      "kind": "jsdom-benchmark",
      "environment": "jsdom",
      "task": "10000 row delete",
      "recordCount": 4,
      "metrics": {
        "latencyMeanMs": {
          "count": 4,
          "median": 239.48122899999976,
          "p95": 242.88704199999984,
          "variance": 5.018409565322083
        },
        "latencyP99Ms": {
          "count": 4,
          "median": 239.48122899999976,
          "p95": 242.88704199999984,
          "variance": 5.018409565322083
        },
        "throughputMeanOpsPerSec": {
          "count": 4,
          "median": 4.175833807586422,
          "p95": 4.214830607285566,
          "variance": 0.001511968106270374
        }
      }
    },
    {
      "kind": "jsdom-benchmark",
      "environment": "jsdom",
      "task": "10000 row keyed middle insert",
      "recordCount": 4,
      "metrics": {
        "latencyMeanMs": {
          "count": 4,
          "median": 53.23410450000006,
          "p95": 54.39787500000011,
          "variance": 0.3592905249073749
        },
        "latencyP99Ms": {
          "count": 4,
          "median": 53.23410450000006,
          "p95": 54.39787500000011,
          "variance": 0.3592905249073749
        },
        "throughputMeanOpsPerSec": {
          "count": 4,
          "median": 18.784979129205773,
          "p95": 18.944791052026698,
          "variance": 0.04337639839393995
        }
      }
    },
    {
      "kind": "jsdom-benchmark",
      "environment": "jsdom",
      "task": "10000 row unkeyed tail append",
      "recordCount": 4,
      "metrics": {
        "latencyMeanMs": {
          "count": 4,
          "median": 38.81433349999975,
          "p95": 40.225832999999966,
          "variance": 0.47672101469452643
        },
        "latencyP99Ms": {
          "count": 4,
          "median": 38.81433349999975,
          "p95": 40.225832999999966,
          "variance": 0.47672101469452643
        },
        "throughputMeanOpsPerSec": {
          "count": 4,
          "median": 25.76367878075544,
          "p95": 26.037259318084143,
          "variance": 0.1981949897828872
        }
      }
    },
    {
      "kind": "jsdom-benchmark",
      "environment": "jsdom",
      "task": "10000 row unkeyed tail remove",
      "recordCount": 4,
      "metrics": {
        "latencyMeanMs": {
          "count": 4,
          "median": 56.64041700000007,
          "p95": 58.19491599999992,
          "variance": 0.8602708383126443
        },
        "latencyP99Ms": {
          "count": 4,
          "median": 56.64041700000007,
          "p95": 58.19491599999992,
          "variance": 0.8602708383126443
        },
        "throughputMeanOpsPerSec": {
          "count": 4,
          "median": 17.65567956981873,
          "p95": 17.964071748718144,
          "variance": 0.08171453522824501
        }
      }
    },
    {
      "kind": "jsdom-benchmark",
      "environment": "jsdom",
      "task": "10000 row keyed middle remove",
      "recordCount": 4,
      "metrics": {
        "latencyMeanMs": {
          "count": 4,
          "median": 60.57400050000001,
          "p95": 63.466042000000016,
          "variance": 2.578760754186895
        },
        "latencyP99Ms": {
          "count": 4,
          "median": 60.57400050000001,
          "p95": 63.466042000000016,
          "variance": 2.578760754186895
        },
        "throughputMeanOpsPerSec": {
          "count": 4,
          "median": 16.509488574937418,
          "p95": 16.916180326482344,
          "variance": 0.18185374158958767
        }
      }
    },
    {
      "kind": "jsdom-benchmark",
      "environment": "jsdom",
      "task": "10000 row keyed tail to head move",
      "recordCount": 4,
      "metrics": {
        "latencyMeanMs": {
          "count": 4,
          "median": 48.775478999999905,
          "p95": 49.06941700000016,
          "variance": 0.23334925610064752
        },
        "latencyP99Ms": {
          "count": 4,
          "median": 48.775478999999905,
          "p95": 49.06941700000016,
          "variance": 0.23334925610064752
        },
        "throughputMeanOpsPerSec": {
          "count": 4,
          "median": 20.50226431840555,
          "p95": 20.913556428696435,
          "variance": 0.04250677192380638
        }
      }
    },
    {
      "kind": "jsdom-benchmark",
      "environment": "jsdom",
      "task": "10000 row keyed mixed insert and move",
      "recordCount": 4,
      "metrics": {
        "latencyMeanMs": {
          "count": 4,
          "median": 57.76156250000008,
          "p95": 58.990542000000005,
          "variance": 0.9708929071311162
        },
        "latencyP99Ms": {
          "count": 4,
          "median": 57.76156250000008,
          "p95": 58.990542000000005,
          "variance": 0.9708929071311162
        },
        "throughputMeanOpsPerSec": {
          "count": 4,
          "median": 17.3129564929996,
          "p95": 17.772498792714124,
          "variance": 0.08829443089982363
        }
      }
    },
    {
      "kind": "jsdom-benchmark",
      "environment": "jsdom",
      "task": "10000 row keyed mixed adjacent insert and move",
      "recordCount": 4,
      "metrics": {
        "latencyMeanMs": {
          "count": 4,
          "median": 60.37393699999984,
          "p95": 60.50483299999996,
          "variance": 0.060480045561666876
        },
        "latencyP99Ms": {
          "count": 4,
          "median": 60.37393699999984,
          "p95": 60.50483299999996,
          "variance": 0.060480045561666876
        },
        "throughputMeanOpsPerSec": {
          "count": 4,
          "median": 16.56348172990422,
          "p95": 16.698254197523628,
          "variance": 0.004608397086491474
        }
      }
    },
    {
      "kind": "jsdom-benchmark",
      "environment": "jsdom",
      "task": "10000 row keyed mixed adjacent remove and move",
      "recordCount": 4,
      "metrics": {
        "latencyMeanMs": {
          "count": 4,
          "median": 61.47445850000008,
          "p95": 61.86970800000017,
          "variance": 0.18016412193780174
        },
        "latencyP99Ms": {
          "count": 4,
          "median": 61.47445850000008,
          "p95": 61.86970800000017,
          "variance": 0.18016412193780174
        },
        "throughputMeanOpsPerSec": {
          "count": 4,
          "median": 16.26714462232428,
          "p95": 16.45265654299618,
          "variance": 0.012741504241917006
        }
      }
    },
    {
      "kind": "jsdom-benchmark",
      "environment": "jsdom",
      "task": "10000 row keyed reorder",
      "recordCount": 4,
      "metrics": {
        "latencyMeanMs": {
          "count": 4,
          "median": 875.9986044999998,
          "p95": 897.9137919999998,
          "variance": 164.2075572978813
        },
        "latencyP99Ms": {
          "count": 4,
          "median": 875.9986044999998,
          "p95": 897.9137919999998,
          "variance": 164.2075572978813
        },
        "throughputMeanOpsPerSec": {
          "count": 4,
          "median": 1.1415742498170598,
          "p95": 1.158778819457877,
          "variance": 0.0002725901385650986
        }
      }
    },
    {
      "kind": "browser-benchmark",
      "scenario": "keyed-reorder",
      "recordCount": 5,
      "metrics": {
        "initialRenderMs": {
          "count": 5,
          "median": 5,
          "p95": 6.5,
          "variance": 0.5896000011205673
        },
        "reorderMs": {
          "count": 5,
          "median": 4.600000008940697,
          "p95": 5.5,
          "variance": 0.15440000066757203
        },
        "unmountMs": {
          "count": 5,
          "median": 1.2999999970197678,
          "p95": 1.2999999970197678,
          "variance": 0.0015999998092651423
        }
      }
    },
    {
      "kind": "browser-benchmark",
      "scenario": "large-list",
      "recordCount": 5,
      "metrics": {
        "initialRenderMs": {
          "count": 5,
          "median": 6.700000002980232,
          "p95": 12.599999994039536,
          "variance": 6.722399988627434
        },
        "updateMs": {
          "count": 5,
          "median": 2.8999999910593033,
          "p95": 5.4000000059604645,
          "variance": 1.0784000012636183
        },
        "unmountMs": {
          "count": 5,
          "median": 1,
          "p95": 1.2000000029802322,
          "variance": 0.01840000138282779
        }
      }
    },
    {
      "kind": "browser-benchmark",
      "scenario": "keyed-reorder:reverse",
      "recordCount": 5,
      "metrics": {
        "initialRenderMs": {
          "count": 5,
          "median": 4.799999997019768,
          "p95": 13.100000008940697,
          "variance": 10.866400024628641
        },
        "reorderMs": {
          "count": 5,
          "median": 4.700000002980232,
          "p95": 6.200000002980232,
          "variance": 0.6216000035047531
        },
        "unmountMs": {
          "count": 5,
          "median": 1.1000000089406967,
          "p95": 1.2999999970197678,
          "variance": 0.010399999475479173
        }
      }
    },
    {
      "kind": "browser-benchmark",
      "scenario": "keyed-reorder:sorted",
      "recordCount": 5,
      "metrics": {
        "initialRenderMs": {
          "count": 5,
          "median": 4.899999991059303,
          "p95": 6.4000000059604645,
          "variance": 0.4296000045776367
        },
        "reorderMs": {
          "count": 5,
          "median": 2.1000000089406967,
          "p95": 2.7999999970197678,
          "variance": 0.11040000066757208
        },
        "unmountMs": {
          "count": 5,
          "median": 1.199999988079071,
          "p95": 1.4000000059604645,
          "variance": 0.02240000042915348
        }
      }
    },
    {
      "kind": "browser-benchmark",
      "scenario": "keyed-reorder:swap-neighbors",
      "recordCount": 5,
      "metrics": {
        "initialRenderMs": {
          "count": 5,
          "median": 4.799999997019768,
          "p95": 5.600000008940697,
          "variance": 0.13760000493526464
        },
        "reorderMs": {
          "count": 5,
          "median": 4.299999997019768,
          "p95": 5.0999999940395355,
          "variance": 0.3103999970912933
        },
        "unmountMs": {
          "count": 5,
          "median": 1.1000000089406967,
          "p95": 1.4000000059604645,
          "variance": 0.018400000429153473
        }
      }
    },
    {
      "kind": "browser-benchmark",
      "scenario": "keyed-reorder:shuffle",
      "recordCount": 5,
      "metrics": {
        "initialRenderMs": {
          "count": 5,
          "median": 5,
          "p95": 8.099999994039536,
          "variance": 1.5975999915838242
        },
        "reorderMs": {
          "count": 5,
          "median": 7,
          "p95": 10.600000008940697,
          "variance": 3.4200000166893005
        },
        "unmountMs": {
          "count": 5,
          "median": 1.2000000029802322,
          "p95": 1.8999999910593033,
          "variance": 0.08959999754428868
        }
      }
    },
    {
      "kind": "browser-benchmark",
      "scenario": "keyed-reorder:shift-window",
      "recordCount": 5,
      "metrics": {
        "initialRenderMs": {
          "count": 5,
          "median": 5.200000002980232,
          "p95": 5.5,
          "variance": 0.07759999969005586
        },
        "reorderMs": {
          "count": 5,
          "median": 3,
          "p95": 3.4000000059604645,
          "variance": 0.08559999980926515
        },
        "unmountMs": {
          "count": 5,
          "median": 1.0999999940395355,
          "p95": 1.2999999970197678,
          "variance": 0.013599999928474438
        }
      }
    }
  ]
}
```
