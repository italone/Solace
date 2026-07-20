import { reactive, render } from "@italone/solace";

interface TodoItem {
  id: number;
  text: string;
  done: boolean;
}

const state = reactive({
  nextId: 3,
  draft: "",
  todos: [
    { id: 1, text: "Read the docs", done: false },
    { id: 2, text: "Ship an example", done: true },
  ] as TodoItem[],
});

function addTodo(): void {
  const text = state.draft.trim();
  if (text.length === 0) {
    return;
  }

  state.todos = [...state.todos, { id: state.nextId, text, done: false }];
  state.nextId += 1;
  state.draft = "";
}

function toggleTodo(id: number): void {
  state.todos = state.todos.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo));
}

function removeTodo(id: number): void {
  state.todos = state.todos.filter((todo) => todo.id !== id);
}

const TodoApp = () => (
  <section>
    <h1>Solace Todo</h1>
    <form
      onSubmit={(event: Event) => {
        event.preventDefault();
        addTodo();
      }}
    >
      <input
        id="todo-input"
        value={state.draft}
        onInput={(event: Event) => {
          state.draft = (event.target as HTMLInputElement).value;
        }}
      />
      <button id="add-todo" type="submit">
        Add
      </button>
    </form>
    <ul id="todo-list">
      {state.todos.map((todo) => (
        <li key={todo.id} data-testid={`todo-${todo.id}`}>
          <label>
            <input type="checkbox" checked={todo.done} onChange={() => toggleTodo(todo.id)} />
            <span>
              {todo.done ? "done" : "open"}: {todo.text}
            </span>
          </label>
          <button type="button" onClick={() => removeTodo(todo.id)}>
            Delete
          </button>
        </li>
      ))}
    </ul>
  </section>
);

const app = document.querySelector("#app");
if (app !== null) {
  render(<TodoApp />, app);
}
