import { h, nextTick, reactive, render } from "@italone/solace";

type BrowserBenchmarkScenario = "large-list" | "keyed-reorder";

type DomMutationCounts = {
  insertBefore: number;
  setAttribute: number;
  removeAttribute: number;
  textContent: number;
  removeChild: number;
};

type BrowserBenchmarkResult = {
  scenario: BrowserBenchmarkScenario;
  rows: number;
  initialRenderMs: number;
  unmountMs: number;
  remainingNodesAfterUnmount: number;
} & (
  | {
      scenario: "large-list";
      updateMs: number;
      selectedText: string;
    }
  | {
      scenario: "keyed-reorder";
      reorderMs: number;
      firstRowText: string;
      domMutationCounts: DomMutationCounts;
    }
);

type BrowserBenchmarkApi = {
  runScenario(scenario: BrowserBenchmarkScenario): Promise<BrowserBenchmarkResult>;
};

declare global {
  interface Window {
    __SOLACE_BENCHMARK__?: BrowserBenchmarkApi;
  }
}

const rows = Array.from({ length: 10_000 }, (_, index) => index + 1);
const output = document.querySelector("#benchmark-output");
const app = document.querySelector("#app");

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

async function runScenario(scenario: BrowserBenchmarkScenario): Promise<BrowserBenchmarkResult> {
  switch (scenario) {
    case "large-list":
      return runLargeListBenchmark();
    case "keyed-reorder":
      return runKeyedReorderBenchmark();
    default:
      throw new Error(`Unknown browser benchmark scenario: ${scenario}`);
  }
}

async function runLargeListBenchmark(): Promise<BrowserBenchmarkResult> {
  const container = ensureApp();
  const state = reactive({
    selected: 1,
  });

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

async function measureDomMutations<T>(run: () => Promise<T>): Promise<{
  result: T;
  counts: DomMutationCounts;
}> {
  const counts: DomMutationCounts = {
    insertBefore: 0,
    setAttribute: 0,
    removeAttribute: 0,
    textContent: 0,
    removeChild: 0,
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  const originalRemoveChild = Node.prototype.removeChild;
  const originalSetAttribute = Element.prototype.setAttribute;
  const originalRemoveAttribute = Element.prototype.removeAttribute;
  const textContentDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");

  if (textContentDescriptor?.set === undefined || textContentDescriptor.get === undefined) {
    throw new Error("Unable to instrument Node.textContent");
  }
  const getTextContent = textContentDescriptor.get;
  const setTextContent = textContentDescriptor.set;

  Node.prototype.insertBefore = function insertBeforeWithCount<TNode extends Node>(
    this: Node,
    node: TNode,
    child: Node | null,
  ): TNode {
    counts.insertBefore += 1;
    return originalInsertBefore.call(this, node, child) as TNode;
  };

  Node.prototype.removeChild = function removeChildWithCount<TNode extends Node>(
    this: Node,
    child: TNode,
  ): TNode {
    counts.removeChild += 1;
    return originalRemoveChild.call(this, child) as TNode;
  };

  Element.prototype.setAttribute = function setAttributeWithCount(
    this: Element,
    qualifiedName: string,
    value: string,
  ): void {
    counts.setAttribute += 1;
    originalSetAttribute.call(this, qualifiedName, value);
  };

  Element.prototype.removeAttribute = function removeAttributeWithCount(
    this: Element,
    qualifiedName: string,
  ): void {
    counts.removeAttribute += 1;
    originalRemoveAttribute.call(this, qualifiedName);
  };

  Object.defineProperty(Node.prototype, "textContent", {
    configurable: textContentDescriptor.configurable,
    enumerable: textContentDescriptor.enumerable,
    get(this: Node): string | null {
      return getTextContent.call(this);
    },
    set(this: Node, value: string | null): void {
      counts.textContent += 1;
      setTextContent.call(this, value);
    },
  });

  try {
    return {
      result: await run(),
      counts,
    };
  } finally {
    Node.prototype.insertBefore = originalInsertBefore;
    Node.prototype.removeChild = originalRemoveChild;
    Element.prototype.setAttribute = originalSetAttribute;
    Element.prototype.removeAttribute = originalRemoveAttribute;
    Object.defineProperty(Node.prototype, "textContent", textContentDescriptor);
  }
}

async function runKeyedReorderBenchmark(): Promise<BrowserBenchmarkResult> {
  const container = ensureApp();
  const state = reactive({
    rowOrder: rows.slice(),
  });

  const KeyedReorder = () => () =>
    h("section", { id: "benchmark-root" }, [
      <h1>Solace Browser Benchmark</h1>,
      <div id="rows">
        {state.rowOrder.map((row) => (
          <div key={row} data-row={row}>
            Row {row}
          </div>
        ))}
      </div>,
    ]);

  const initialStart = now();
  render(h(KeyedReorder), container);
  const firstRenderedRow = container.querySelector("#rows > div:first-child");
  const initialRenderMs = now() - initialStart;

  if (firstRenderedRow?.textContent?.trim() !== "Row 1") {
    throw new Error("Initial keyed rows were not rendered");
  }

  const { result: reorderMs, counts: domMutationCounts } = await measureDomMutations(async () => {
    const reorderStart = now();
    state.rowOrder = [...state.rowOrder].reverse();
    await nextTick();
    return now() - reorderStart;
  });
  const reorderedFirstRow = container.querySelector("#rows > div:first-child");
  const firstRowText = reorderedFirstRow?.textContent?.trim() ?? "";

  if (firstRowText !== "Row 10000") {
    throw new Error("Reordered first row was not rendered");
  }

  const unmountStart = now();
  render(<section id="benchmark-complete">complete</section>, container);
  const unmountMs = now() - unmountStart;
  const remainingNodesAfterUnmount = container.querySelectorAll("#rows > div").length;

  const result: BrowserBenchmarkResult = {
    scenario: "keyed-reorder",
    rows: rows.length,
    initialRenderMs,
    reorderMs,
    unmountMs,
    firstRowText,
    remainingNodesAfterUnmount,
    domMutationCounts,
  };

  writeResult(result);
  return result;
}

window.__SOLACE_BENCHMARK__ = {
  runScenario,
};

if (app !== null) {
  render(<p>Browser benchmark ready</p>, app);
}
