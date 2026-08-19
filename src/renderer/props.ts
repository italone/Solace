import { isEventProp } from "../event/event";
import type { VNodeProps } from "../vnode/vnode";
import { patchProp } from "./dom";

export function havePropsChanged(oldProps: VNodeProps | null, newProps: VNodeProps | null): boolean {
  if (oldProps === newProps) {
    return false;
  }

  if (oldProps === null) {
    return hasPatchableProps(newProps);
  }

  if (newProps === null) {
    return hasPatchableProps(oldProps);
  }

  for (const key in oldProps) {
    if (!hasOwnProp(oldProps, key) || key === "key") {
      continue;
    }

    if (!hasOwnProp(newProps, key) || oldProps[key] !== newProps[key]) {
      return true;
    }
  }

  for (const key in newProps) {
    if (!hasOwnProp(newProps, key) || key === "key") {
      continue;
    }

    if (!hasOwnProp(oldProps, key)) {
      return true;
    }
  }

  return false;
}

function hasPatchableProps(props: VNodeProps | null): boolean {
  if (props === null) {
    return false;
  }

  for (const key in props) {
    if (hasOwnProp(props, key) && key !== "key") {
      return true;
    }
  }

  return false;
}

function hasOwnProp(props: VNodeProps, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(props, key);
}

export function mountInitialProps(el: Element, props: VNodeProps): void {
  for (const key in props) {
    if (!hasOwnProp(props, key) || key === "key") {
      continue;
    }

    const value = props[key];
    if (value === null || value === undefined || value === false) {
      continue;
    }

    if (key === "class") {
      mountInitialClass(el, value);
      continue;
    }

    if (mightBeEventProp(key)) {
      patchProp(el, key, null, value);
      continue;
    }

    el.setAttribute(key, String(value));
  }
}

function mountInitialClass(el: Element, value: unknown): void {
  if (el instanceof HTMLElement) {
    el.className = String(value);
    return;
  }

  el.setAttribute("class", String(value));
}

function mightBeEventProp(key: string): boolean {
  return key.length > 2 && key[0] === "o" && key[1] === "n" && isEventProp(key);
}

export function patchProps(el: Element, oldProps: VNodeProps | null, newProps: VNodeProps | null): void {
  const previousProps = oldProps ?? {};
  const nextProps = newProps ?? {};

  for (const [key, nextValue] of Object.entries(nextProps)) {
    if (key === "key") {
      continue;
    }

    const previousValue = previousProps[key];
    if (previousValue !== nextValue) {
      patchProp(el, key, previousValue, nextValue);
    }
  }

  for (const key of Object.keys(previousProps)) {
    if (key !== "key" && !(key in nextProps)) {
      patchProp(el, key, previousProps[key], null);
    }
  }
}

export function hasEventProps(props: VNodeProps | null): boolean {
  if (props === null) {
    return false;
  }

  return Object.keys(props).some(isEventProp);
}
