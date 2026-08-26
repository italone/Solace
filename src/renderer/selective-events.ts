const BUFFERED_EVENT_TYPES = ["click", "pointerdown", "keydown", "input", "change"] as const;

interface BufferedEvent {
  target: Node;
  type: string;
  event: Event;
}

function rebuildEvent(entry: BufferedEvent): Event {
  const original = entry.event;
  const init: EventInit = { bubbles: true, cancelable: true };
  if (typeof KeyboardEvent === "function" && original instanceof KeyboardEvent) {
    return new KeyboardEvent(entry.type, {
      ...init,
      key: original.key,
      code: original.code,
      ctrlKey: original.ctrlKey,
      shiftKey: original.shiftKey,
      altKey: original.altKey,
      metaKey: original.metaKey,
      repeat: original.repeat,
    });
  }
  if (typeof PointerEvent === "function" && original instanceof PointerEvent) {
    return new PointerEvent(entry.type, {
      ...init,
      clientX: original.clientX,
      clientY: original.clientY,
      button: original.button,
      buttons: original.buttons,
      ctrlKey: original.ctrlKey,
      shiftKey: original.shiftKey,
      altKey: original.altKey,
      metaKey: original.metaKey,
      pointerId: original.pointerId,
      pointerType: original.pointerType,
      isPrimary: original.isPrimary,
    });
  }
  if (typeof MouseEvent === "function" && original instanceof MouseEvent) {
    return new MouseEvent(entry.type, {
      ...init,
      clientX: original.clientX,
      clientY: original.clientY,
      button: original.button,
      buttons: original.buttons,
      ctrlKey: original.ctrlKey,
      shiftKey: original.shiftKey,
      altKey: original.altKey,
      metaKey: original.metaKey,
    });
  }
  if (typeof InputEvent === "function" && original instanceof InputEvent) {
    return new InputEvent(entry.type, {
      ...init,
      data: original.data,
      inputType: original.inputType,
    });
  }
  return new Event(entry.type, init);
}

export interface SelectiveEventBufferHandle {
  replay(): void;
  detach(): void;
}

export function attachSelectiveEventBuffer(container: Element): SelectiveEventBufferHandle {
  const buffer: BufferedEvent[] = [];

  const listener = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    buffer.push({ target: event.target as Node, type: event.type, event });
  };

  const addListeners = (): void => {
    for (const type of BUFFERED_EVENT_TYPES) {
      container.addEventListener(type, listener, { capture: true });
    }
  };

  const removeListeners = (): void => {
    for (const type of BUFFERED_EVENT_TYPES) {
      container.removeEventListener(type, listener, { capture: true });
    }
  };

  addListeners();

  return {
    replay(): void {
      // Replayed events must reach their targets, so interception stops for
      // good here: the capture listener's stopPropagation would otherwise
      // block them from ever arriving.
      removeListeners();
      for (const entry of buffer) {
        if (!entry.target.isConnected) {
          continue;
        }
        entry.target.dispatchEvent(rebuildEvent(entry));
      }
      buffer.length = 0;
    },
    detach(): void {
      removeListeners();
      buffer.length = 0;
    },
  };
}
