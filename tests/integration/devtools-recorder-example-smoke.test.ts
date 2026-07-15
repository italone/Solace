import { afterEach, describe, expect, it } from "vitest";

import { clearDevtoolsListeners, createDevtoolsRecorder } from "../../src/devtools/events";
import { createStore, h, nextTick, render } from "../../src/index";
import type { StoreGetterContext } from "../../src/index";

type Todo = {
  id: number;
  done: boolean;
  text: string;
};
type TodoState = {
  nextId: number;
  todos: Todo[];
};

describe("devtools recorder example smoke", () => {
  afterEach(() => {
    clearDevtoolsListeners();
  });

  it("captures serialized events for a todo-style interaction after clearing initial mount noise", async () => {
    const recorder = createDevtoolsRecorder();
    const store = createStore({
      state: (): TodoState => ({
        nextId: 1,
        todos: [],
      }),
      actions: {
        addTodo({ state }: StoreGetterContext<TodoState>, text: string) {
          state.todos = [
            ...state.todos,
            {
              id: state.nextId,
              done: false,
              text,
            },
          ];
          state.nextId += 1;
        },
      },
    });
    const container = document.createElement("div");
    const TodoApp = () => () =>
      h("section", null, [
        h("button", { onClick: () => store.actions.addTodo("write smoke") }, "add"),
        h(
          "ul",
          null,
          store.state.todos.map((todo) => h("li", { key: todo.id }, todo.text)),
        ),
      ]);

    render(h(TodoApp), container);
    recorder.clear();

    container.querySelector("button")?.click();
    await nextTick();

    expect(container.textContent).toContain("write smoke");
    expect(recorder.snapshot().map((event) => event.type)).toEqual([
      "reactivity:trigger",
      "store:action",
      "renderer:element",
      "renderer:element",
      "renderer:element",
      "renderer:element",
      "component:update",
      "scheduler:flush",
    ]);

    for (const event of recorder.snapshot()) {
      expect(JSON.parse(JSON.stringify(event))).toEqual(event);
      expect(event).not.toHaveProperty("target");
      expect(event).not.toHaveProperty("node");
      expect(event).not.toHaveProperty("vnode");
      expect(event).not.toHaveProperty("state");
      expect(event).not.toHaveProperty("args");
    }

    recorder.stop();
  });
});
