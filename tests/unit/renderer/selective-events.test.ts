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
});
