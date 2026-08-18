import { createStore, h, reactive, render } from "@italone/solace";
import { onDevtoolsEvent } from "@italone/solace/devtools";

const store = createStore({
  state: () => ({ count: 0 }),
  actions: {
    increment(context: { state: { count: number } }) {
      context.state.count += 1;
    },
  },
});

// Record public `store:action` summaries through the public DevTools subpath so
// the extension panel has real events to display for this demo origin.
const recordedActions: Array<{ type: string; time: number }> = [];
onDevtoolsEvent((event) => {
  if (event.type === "store:action") {
    recordedActions.push({ type: event.name, time: Date.now() });
  }
});

const state = reactive({ count: store.state.count });

function Counter() {
  return () =>
    h("main", null, [
      h("p", { id: "counter" }, `count: ${state.count}`),
      h(
        "button",
        {
          id: "increment",
          type: "button",
          onClick: () => {
            store.actions.increment();
            state.count = store.state.count;
          },
        },
        "increment",
      ),
      h(
        "p",
        { id: "recorded-actions" },
        `recorded store actions: ${recordedActions.length}`,
      ),
    ]);
}

const app = document.querySelector("#app");
if (app !== null) {
  render(<Counter />, app);
}
