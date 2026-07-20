import { reactive, render } from "@italone/solace";

const state = reactive({ count: 0 });

const Counter = () => (
  <button
    id="counter"
    type="button"
    onClick={() => {
      state.count += 1;
    }}
  >
    count: {state.count}
  </button>
);

const app = document.querySelector("#app");
if (app !== null) {
  render(<Counter />, app);
}
