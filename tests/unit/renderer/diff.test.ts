import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearDevtoolsListeners,
  onDevtoolsEvent,
  type DevtoolsEvent,
} from "../../../src/devtools/events";
import { h, render } from "../../../src/index";

describe("renderer diff", () => {
  afterEach(() => {
    clearDevtoolsListeners();
    vi.restoreAllMocks();
  });

  it("patches props on the same element type", () => {
    const container = document.createElement("div");
    const onClick = vi.fn();
    const nextClick = vi.fn();

    render(
      h("button", { id: "save", class: "primary", disabled: true, onClick }, "Save"),
      container,
    );
    const button = container.querySelector("button");

    render(
      h("button", { id: "done", "data-state": "ready", onClick: nextClick }, "Save"),
      container,
    );
    const patchedButton = container.querySelector("button");

    expect(patchedButton).toBe(button);
    expect(patchedButton?.getAttribute("id")).toBe("done");
    expect(patchedButton?.getAttribute("data-state")).toBe("ready");
    expect(patchedButton?.hasAttribute("class")).toBe(false);
    expect(patchedButton?.hasAttribute("disabled")).toBe(false);

    patchedButton?.dispatchEvent(new MouseEvent("click"));

    expect(onClick).not.toHaveBeenCalled();
    expect(nextClick).toHaveBeenCalledTimes(1);
  });

  it("updates text children without replacing the element", () => {
    const container = document.createElement("div");

    render(h("p", null, "before"), container);
    const paragraph = container.querySelector("p");

    render(h("p", null, "after"), container);

    expect(container.innerHTML).toBe("<p>after</p>");
    expect(container.querySelector("p")).toBe(paragraph);
  });

  it("patches non-keyed array children by index and mounts or removes extras", () => {
    const container = document.createElement("div");

    render(h("ul", null, [h("li", null, "a"), h("li", null, "b")]), container);
    const first = container.querySelectorAll("li")[0];

    render(h("ul", null, [h("li", null, "A"), h("li", null, "B"), h("li", null, "C")]), container);

    expect([...container.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
      "A",
      "B",
      "C",
    ]);
    expect(container.querySelectorAll("li")[0]).toBe(first);

    render(h("ul", null, [h("li", null, "only")]), container);

    expect(container.innerHTML).toBe("<ul><li>only</li></ul>");
    expect(container.querySelector("li")).toBe(first);
  });

  it("moves keyed children while reusing existing DOM nodes", () => {
    const container = document.createElement("div");

    render(
      h("ul", null, [
        h("li", { key: "a" }, "A"),
        h("li", { key: "b" }, "B"),
        h("li", { key: "c" }, "C"),
        h("li", { key: "d" }, "D"),
      ]),
      container,
    );

    const before = new Map([...container.querySelectorAll("li")].map((li) => [li.textContent, li]));

    render(
      h("ul", null, [
        h("li", { key: "d" }, "D"),
        h("li", { key: "b" }, "B"),
        h("li", { key: "a" }, "A"),
        h("li", { key: "e" }, "E"),
      ]),
      container,
    );

    const after = [...container.querySelectorAll("li")];

    expect(after.map((li) => li.textContent)).toEqual(["D", "B", "A", "E"]);
    expect(after[0]).toBe(before.get("D"));
    expect(after[1]).toBe(before.get("B"));
    expect(after[2]).toBe(before.get("A"));
    expect(after[3]).not.toBe(before.get("C"));
    expect(before.get("C")?.isConnected).toBe(false);
  });

  it("mounts keyed children between synced prefix and suffix", () => {
    const container = document.createElement("div");

    render(h("ul", null, [h("li", { key: "a" }, "A"), h("li", { key: "d" }, "D")]), container);
    const first = container.querySelectorAll("li")[0];
    const last = container.querySelectorAll("li")[1];

    render(
      h("ul", null, [
        h("li", { key: "a" }, "A"),
        h("li", { key: "b" }, "B"),
        h("li", { key: "c" }, "C"),
        h("li", { key: "d" }, "D"),
      ]),
      container,
    );

    const after = [...container.querySelectorAll("li")];

    expect(after.map((li) => li.textContent)).toEqual(["A", "B", "C", "D"]);
    expect(after[0]).toBe(first);
    expect(after[3]).toBe(last);
  });

  it("removes keyed children between synced prefix and suffix", () => {
    const container = document.createElement("div");

    render(
      h("ul", null, [
        h("li", { key: "a" }, "A"),
        h("li", { key: "b" }, "B"),
        h("li", { key: "c" }, "C"),
        h("li", { key: "d" }, "D"),
      ]),
      container,
    );
    const first = container.querySelectorAll("li")[0];
    const last = container.querySelectorAll("li")[3];
    const removed = container.querySelectorAll("li")[1];

    render(
      h("ul", null, [
        h("li", { key: "a" }, "A"),
        h("li", { key: "c" }, "C"),
        h("li", { key: "d" }, "D"),
      ]),
      container,
    );

    const after = [...container.querySelectorAll("li")];

    expect(after.map((li) => li.textContent)).toEqual(["A", "C", "D"]);
    expect(after[0]).toBe(first);
    expect(after[2]).toBe(last);
    expect(removed.isConnected).toBe(false);
  });

  it("handles keyed insert, remove, and move in one patch", () => {
    const container = document.createElement("div");

    render(
      h("ul", null, [
        h("li", { key: "a" }, "A"),
        h("li", { key: "b" }, "B"),
        h("li", { key: "c" }, "C"),
        h("li", { key: "d" }, "D"),
      ]),
      container,
    );
    const before = new Map([...container.querySelectorAll("li")].map((li) => [li.textContent, li]));

    render(
      h("ul", null, [
        h("li", { key: "d" }, "D"),
        h("li", { key: "b" }, "B"),
        h("li", { key: "e" }, "E"),
        h("li", { key: "a" }, "A"),
      ]),
      container,
    );

    const after = [...container.querySelectorAll("li")];

    expect(after.map((li) => li.textContent)).toEqual(["D", "B", "E", "A"]);
    expect(after[0]).toBe(before.get("D"));
    expect(after[1]).toBe(before.get("B"));
    expect(after[3]).toBe(before.get("A"));
    expect(before.get("C")?.isConnected).toBe(false);
  });

  it("minimizes DOM moves for keyed reorders with a stable subsequence", () => {
    const container = document.createElement("div");
    const insertBefore = vi.spyOn(Node.prototype, "insertBefore");

    render(
      h("ul", null, [
        h("li", { key: "a" }, "A"),
        h("li", { key: "b" }, "B"),
        h("li", { key: "c" }, "C"),
        h("li", { key: "d" }, "D"),
        h("li", { key: "e" }, "E"),
      ]),
      container,
    );

    insertBefore.mockClear();

    const before = new Map([...container.querySelectorAll("li")].map((li) => [li.textContent, li]));

    render(
      h("ul", null, [
        h("li", { key: "b" }, "B"),
        h("li", { key: "a" }, "A"),
        h("li", { key: "d" }, "D"),
        h("li", { key: "c" }, "C"),
        h("li", { key: "e" }, "E"),
      ]),
      container,
    );

    const after = [...container.querySelectorAll("li")];

    expect(after.map((li) => li.textContent)).toEqual(["B", "A", "D", "C", "E"]);
    expect(after[0]).toBe(before.get("B"));
    expect(after[1]).toBe(before.get("A"));
    expect(after[2]).toBe(before.get("D"));
    expect(after[3]).toBe(before.get("C"));
    expect(after[4]).toBe(before.get("E"));
    expect(insertBefore).toHaveBeenCalledTimes(2);
  });

  it("falls back to index patching for mixed keyed and unkeyed children", () => {
    const container = document.createElement("div");

    render(
      h("ul", null, [
        h("li", { key: "a" }, "A"),
        h("li", null, "plain"),
        h("li", { key: "b" }, "B"),
      ]),
      container,
    );
    const firstKeyed = container.querySelectorAll("li")[0];
    const middle = container.querySelectorAll("li")[1];
    const lastKeyed = container.querySelectorAll("li")[2];

    render(
      h("ul", null, [
        h("li", { key: "b" }, "B"),
        h("li", null, "plain updated"),
        h("li", { key: "a" }, "A"),
      ]),
      container,
    );

    const after = [...container.querySelectorAll("li")];

    expect(after.map((li) => li.textContent)).toEqual(["B", "plain updated", "A"]);
    expect(after[0]).not.toBe(lastKeyed);
    expect(after[1]).toBe(middle);
    expect(after[2]).not.toBe(firstKeyed);
  });

  it("falls back to index patching when keyed children contain duplicate keys", () => {
    const container = document.createElement("div");

    render(
      h("ul", null, [
        h("li", { key: "x" }, "x"),
        h("li", { key: "a" }, "first"),
        h("li", { key: "a" }, "second"),
        h("li", { key: "y" }, "y"),
      ]),
      container,
    );
    const first = container.querySelectorAll("li")[1];
    const second = container.querySelectorAll("li")[2];

    render(
      h("ul", null, [
        h("li", { key: "x" }, "x"),
        h("li", { key: "a" }, "second"),
        h("li", { key: "a" }, "first"),
        h("li", { key: "y" }, "y"),
      ]),
      container,
    );

    const after = [...container.querySelectorAll("li")];

    expect(after.map((li) => li.textContent)).toEqual(["x", "second", "first", "y"]);
    expect(after[1]).toBe(first);
    expect(after[2]).toBe(second);
  });

  it("emits devtools summaries for element mount, update, and unmount", () => {
    const events: DevtoolsEvent[] = [];
    const container = document.createElement("div");

    onDevtoolsEvent((event) => {
      events.push(event);
    });

    render(h("p", { class: "before" }, "before"), container);
    render(h("p", { class: "after" }, "after"), container);
    render(h("section", null, "next"), container);

    expect(events).toEqual([
      { type: "renderer:element", operation: "mount", tag: "p" },
      { type: "renderer:element", operation: "update", tag: "p" },
      { type: "renderer:element", operation: "unmount", tag: "p" },
      { type: "renderer:element", operation: "mount", tag: "section" },
    ]);

    for (const event of events) {
      expect(event).not.toHaveProperty("node");
      expect(event).not.toHaveProperty("el");
      expect(event).not.toHaveProperty("vnode");
      expect(event).not.toHaveProperty("props");
      expect(event).not.toHaveProperty("children");
    }
  });
});
