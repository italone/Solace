import { escapeAttribute, escapeHtml } from "../shared/html";

export interface StyleSink {
  register(scopeId: string, css: string): void;
}

export interface ServerStyleSink extends StyleSink {
  styles: string[];
}

const sinkStack: StyleSink[] = [];

export function useStyle(scopeId: string, css: string): void {
  const sink = getActiveStyleSink();
  if (sink === undefined) {
    throw new Error("useStyle() must be called while rendering a component");
  }

  sink.register(scopeId, css);
}

export function withStyleSink<T>(sink: StyleSink, run: () => T): T {
  sinkStack.push(sink);
  try {
    return run();
  } finally {
    sinkStack.pop();
  }
}

export function getActiveStyleSink(): StyleSink | undefined {
  return sinkStack[sinkStack.length - 1];
}

export function createServerStyleSink(): ServerStyleSink {
  const styles: string[] = [];
  const registry = new Map<string, string>();

  return {
    styles,
    register(scopeId, css) {
      registerStyle(registry, scopeId, css, (serializedTag) => {
        styles.push(serializedTag);
      });
    },
  };
}

export function createDocumentStyleSink(document: Document): StyleSink {
  const registry = new Map<string, string>();

  for (const styleElement of Array.from(document.querySelectorAll("style[data-s-id]"))) {
    const scopeId = styleElement.getAttribute("data-s-id");
    if (scopeId === null) {
      continue;
    }

    const css = styleElement.textContent ?? "";
    const existing = registry.get(scopeId);
    if (existing !== undefined && !isEquivalentStyle(existing, css)) {
      throwStyleConflict(scopeId);
    }

    registry.set(scopeId, css);
  }

  return {
    register(scopeId, css) {
      registerStyle(registry, scopeId, css, () => {
        const styleElement = document.createElement("style");
        styleElement.setAttribute("data-s-id", scopeId);
        styleElement.textContent = css;
        document.head.appendChild(styleElement);
      });
    },
  };
}

function registerStyle(
  registry: Map<string, string>,
  scopeId: string,
  css: string,
  onRegister: (serializedTag: string) => void,
): void {
  const existing = registry.get(scopeId);
  if (existing !== undefined) {
    if (!isEquivalentStyle(existing, css)) {
      throwStyleConflict(scopeId);
    }

    registry.set(scopeId, css);
    return;
  }

  registry.set(scopeId, css);
  onRegister(serializeStyleTag(scopeId, css));
}

function serializeStyleTag(scopeId: string, css: string): string {
  return `<style data-s-id="${escapeAttribute(scopeId)}">${escapeHtml(css)}</style>`;
}

function isEquivalentStyle(existing: string, css: string): boolean {
  return existing === css || existing === escapeHtml(css);
}

function throwStyleConflict(scopeId: string): never {
  throw new Error(`Style conflict for ${scopeId}`);
}
