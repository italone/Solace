import { reactive, render } from "solace";

const rows = Array.from({ length: 10_000 }, (_, index) => index + 1);
const state = reactive({
  selected: 1,
});

const LargeList = () => (
  <section>
    <h1>Solace Large List</h1>
    <button
      id="select-middle"
      type="button"
      onClick={() => {
        state.selected = 5000;
      }}
    >
      Select 5000
    </button>
    <p id="selected-row">selected: {state.selected}</p>
    <div id="rows">
      {rows.map((row) => (
        <div key={row} data-row={row} class={state.selected === row ? "selected" : ""}>
          Row {row}
          {state.selected === row ? " selected" : ""}
        </div>
      ))}
    </div>
  </section>
);

const app = document.querySelector("#app");
if (app !== null) {
  render(<LargeList />, app);
}
