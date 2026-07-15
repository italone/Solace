import { h, nextTick, reactive, render } from "solace";

type BrowserBenchmarkResult = {
  scenario: "large-list";
  rows: number;
  initialRenderMs: number;
  updateMs: number;
  unmountMs: number;
  selectedText: string;
  remainingNodesAfterUnmount: number;
};

type BrowserBenchmarkApi = {
  run(): Promise<BrowserBenchmarkResult>;
};

declare global {
  interface Window {
    __SOLACE_BENCHMARK__?: BrowserBenchmarkApi;
  }
}

const rows = Array.from({ length: 10_000 }, (_, index) => index + 1);
const state = reactive({
  selected: 1,
});

const output = document.querySelector("#benchmark-output");
const app = document.querySelector("#app");

const LargeList = () => () =>
  h("section", { id: "benchmark-root" }, [
    <h1>Solace Browser Benchmark</h1>,
    <p id="selected-row">selected: {state.selected}</p>,
    <div id="rows">
      {rows.map((row) => (
        <div key={row} data-row={row} class={state.selected === row ? "selected" : ""}>
          Row {row}
          {state.selected === row ? " selected" : ""}
        </div>
      ))}
    </div>,
  ]);

function ensureApp(): Element {
  if (app === null) {
    throw new Error("Missing #app benchmark mount point");
  }

  return app;
}

function now(): number {
  return performance.now();
}

function writeResult(result: BrowserBenchmarkResult): void {
  if (output !== null) {
    output.textContent = JSON.stringify(result, null, 2);
  }
}

async function runBenchmark(): Promise<BrowserBenchmarkResult> {
  const container = ensureApp();
  state.selected = 1;

  const initialStart = now();
  render(h(LargeList), container);
  const firstSelected = container.querySelector('[data-row="1"]');
  const initialRenderMs = now() - initialStart;

  if (firstSelected?.textContent?.includes("selected") !== true) {
    throw new Error("Initial selected row was not rendered");
  }

  const updateStart = now();
  state.selected = 5000;
  await nextTick();
  const selected = container.querySelector('[data-row="5000"]');
  const selectedText = selected?.textContent ?? "";
  const updateMs = now() - updateStart;

  if (!selectedText.includes("selected")) {
    throw new Error("Updated selected row was not rendered");
  }

  const unmountStart = now();
  render(<section id="benchmark-complete">complete</section>, container);
  const unmountMs = now() - unmountStart;
  const remainingNodesAfterUnmount = container.querySelectorAll("#rows > div").length;

  const result: BrowserBenchmarkResult = {
    scenario: "large-list",
    rows: rows.length,
    initialRenderMs,
    updateMs,
    unmountMs,
    selectedText,
    remainingNodesAfterUnmount,
  };

  writeResult(result);
  return result;
}

window.__SOLACE_BENCHMARK__ = {
  run: runBenchmark,
};

if (app !== null) {
  render(<p>Browser benchmark ready</p>, app);
}
