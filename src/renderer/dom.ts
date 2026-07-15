import { isEventProp, patchEvent, removeEvents } from "../event/event";

export function createElement(type: string): Element {
  return document.createElement(type);
}

export function insert(child: Node, parent: Node, anchor: Node | null = null): void {
  parent.insertBefore(child, anchor);
}

export function setText(node: Node, text: string): void {
  node.textContent = text;
}

export function remove(child: Node): void {
  if (child instanceof Element) {
    removeEvents(child);
  }

  child.parentNode?.removeChild(child);
}

export function patchProp(
  el: Element,
  key: string,
  previousValue: unknown,
  nextValue: unknown,
): void {
  if (isEventProp(key)) {
    patchEvent(el, key, previousValue, nextValue);
    return;
  }

  if (nextValue === null || nextValue === undefined || nextValue === false) {
    el.removeAttribute(key);
    return;
  }

  el.setAttribute(key, String(nextValue));
}
