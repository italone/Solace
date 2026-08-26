const BUFFERED_EVENT_TYPES = ["click", "pointerdown", "keydown", "input", "change"] as const;

interface BufferedEvent {
  target: Node;
  type: string;
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
    buffer.push({ target: event.target as Node, type: event.type });
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
        entry.target.dispatchEvent(new Event(entry.type, { bubbles: true, cancelable: true }));
      }
      buffer.length = 0;
    },
    detach(): void {
      removeListeners();
      buffer.length = 0;
    },
  };
}
