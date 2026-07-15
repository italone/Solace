export type EventModifier = (event: Event) => boolean;

export function withModifiers(handler: EventListener, modifiers: EventModifier[]): EventListener {
  return (event) => {
    for (const modifier of modifiers) {
      if (!modifier(event)) {
        return;
      }
    }

    handler(event);
  };
}
