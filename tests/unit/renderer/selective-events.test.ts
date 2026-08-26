import { describe, expect, it, vi } from "vitest";

import { attachSelectiveEventBuffer } from "../../../src/renderer/selective-events";

describe("SelectiveEventBuffer", () => {
  it("buffers and replays a click on the original target", () => {
    const container = document.createElement("div");
    container.innerHTML = '<button id="btn">go</button>';
    document.body.appendChild(container);
    const onClick = vi.fn();
    const button = container.querySelector("#btn") as HTMLButtonElement;
    button.addEventListener("click", onClick);

    const handle = attachSelectiveEventBuffer(container);
    button.click();
    expect(onClick).not.toHaveBeenCalled();

    handle.replay();
    expect(onClick).toHaveBeenCalledTimes(1);
    handle.detach();
    document.body.removeChild(container);
  });

  it("drops events whose target left the DOM", () => {
    const container = document.createElement("div");
    container.innerHTML = '<button id="gone">go</button>';
    document.body.appendChild(container);
    const onClick = vi.fn();
    const button = container.querySelector("#gone") as HTMLButtonElement;
    button.addEventListener("click", onClick);

    const handle = attachSelectiveEventBuffer(container);
    button.click();
    button.remove();
    handle.replay();
    expect(onClick).not.toHaveBeenCalled();
    handle.detach();
    document.body.removeChild(container);
  });

  it("stops buffering after replay+detach", () => {
    const container = document.createElement("div");
    container.innerHTML = '<button id="btn2">go</button>';
    document.body.appendChild(container);
    const onClick = vi.fn();
    const button = container.querySelector("#btn2") as HTMLButtonElement;
    button.addEventListener("click", onClick);

    const handle = attachSelectiveEventBuffer(container);
    button.click();
    handle.replay();
    button.click();
    expect(onClick).toHaveBeenCalledTimes(2);
    handle.detach();
    document.body.removeChild(container);
  });

  it("clears the buffer on detach without replaying", () => {
    const container = document.createElement("div");
    container.innerHTML = '<button id="btn3">go</button>';
    document.body.appendChild(container);
    const onClick = vi.fn();
    const button = container.querySelector("#btn3") as HTMLButtonElement;
    button.addEventListener("click", onClick);

    const handle = attachSelectiveEventBuffer(container);
    button.click();
    handle.detach();
    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    document.body.removeChild(container);
  });

  it("replays keydown events with their key payload", () => {
    const container = document.createElement("div");
    container.innerHTML = '<button id="k">go</button>';
    document.body.appendChild(container);
    const seen: string[] = [];
    const button = container.querySelector("#k") as HTMLButtonElement;
    button.addEventListener("keydown", (e) => seen.push((e as KeyboardEvent).key));

    const handle = attachSelectiveEventBuffer(container);
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(seen).toEqual([]);

    handle.replay();
    expect(seen).toEqual(["Enter"]);
    handle.detach();
    document.body.removeChild(container);
  });

  it("replays input events as input events", () => {
    const container = document.createElement("div");
    container.innerHTML = '<input id="inp" />';
    document.body.appendChild(container);
    const seen: string[] = [];
    const input = container.querySelector("#inp") as HTMLInputElement;
    input.addEventListener("input", (e) => seen.push(e.type));

    const handle = attachSelectiveEventBuffer(container);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(seen).toEqual([]);
    handle.replay();
    expect(seen).toEqual(["input"]);
    handle.detach();
    document.body.removeChild(container);
  });

  it("replays click events with mouse coordinates", () => {
    const container = document.createElement("div");
    container.innerHTML = '<button id="m">go</button>';
    document.body.appendChild(container);
    const seen: Array<{ x: number; y: number }> = [];
    const button = container.querySelector("#m") as HTMLButtonElement;
    button.addEventListener("click", (e) =>
      seen.push({ x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY }),
    );

    const handle = attachSelectiveEventBuffer(container);
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 12, clientY: 34 }));
    expect(seen).toEqual([]);

    handle.replay();
    expect(seen).toEqual([{ x: 12, y: 34 }]);
    handle.detach();
    document.body.removeChild(container);
  });
});
