type EventInvoker = EventListener & {
  value: EventListener;
};
type EventInvokerMap = Record<string, EventInvoker | undefined>;
type ElementWithInvokers = Element & {
  _vei?: EventInvokerMap;
};

export function isEventProp(key: string): boolean {
  return /^on[A-Z]/.test(key);
}

export function patchEvent(
  el: Element,
  key: string,
  previousValue: unknown,
  nextValue: unknown,
): void {
  const invokers = getInvokers(el);
  const existingInvoker = invokers[key];
  const nextEventValue = normalizeEventValue(nextValue);

  if (existingInvoker !== undefined && nextEventValue !== null) {
    existingInvoker.value = nextEventValue;
    return;
  }

  const eventName = key.slice(2).toLowerCase();

  if (nextEventValue !== null) {
    const invoker = createInvoker(nextEventValue);
    invokers[key] = invoker;
    el.addEventListener(eventName, invoker);
    return;
  }

  if (existingInvoker !== undefined) {
    el.removeEventListener(eventName, existingInvoker);
    invokers[key] = undefined;
  }
}

export function removeEvents(el: Element): void {
  const invokers = (el as ElementWithInvokers)._vei;
  if (invokers === undefined) {
    return;
  }

  for (const [key, invoker] of Object.entries(invokers)) {
    if (invoker !== undefined) {
      el.removeEventListener(key.slice(2).toLowerCase(), invoker);
      invokers[key] = undefined;
    }
  }
}

function getInvokers(el: Element): EventInvokerMap {
  const element = el as ElementWithInvokers;
  element._vei ??= {};
  return element._vei;
}

function createInvoker(initialValue: EventListener): EventInvoker {
  const invoker = ((event: Event) => {
    invoker.value(event);
  }) as EventInvoker;

  invoker.value = initialValue;
  return invoker;
}

function normalizeEventValue(value: unknown): EventListener | null {
  return typeof value === "function" ? (value as EventListener) : null;
}
