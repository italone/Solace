import { escapeAttribute } from "../shared/html";

export interface StyleSink {
  register(scopeId: string, css: string): void;
}

export interface ServerStyleSink extends StyleSink {
  styles: string[];
  registrations: StyleRegistration[];
}

export interface StyleRegistration {
  scopeId: string;
  css: string;
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
  const registrations: StyleRegistration[] = [];
  const registry = new Map<string, string>();

  return {
    styles,
    registrations,
    register(scopeId, css) {
      registerStyle(registry, scopeId, css, (serializedTag) => {
        registrations.push({ scopeId, css });
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

    const css = styleElement.getAttribute("data-s-css") ?? styleElement.textContent ?? "";
    const existing = registry.get(scopeId);
    if (existing !== undefined && existing !== css) {
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
    if (existing !== css) {
      throwStyleConflict(scopeId);
    }

    return;
  }

  registry.set(scopeId, css);
  onRegister(serializeStyleTag(scopeId, css));
}

function serializeStyleTag(scopeId: string, css: string): string {
  const serializedCss = escapeStyleText(css);
  const rawCssAttribute = serializedCss === css ? "" : ` data-s-css="${escapeAttribute(css)}"`;
  return `<style data-s-id="${escapeAttribute(scopeId)}"${rawCssAttribute}>${serializedCss}</style>`;
}

function escapeStyleText(css: string): string {
  return css.replace(/<\/(style)/gi, (_match, tagName: string) => `<\\/${tagName}`);
}

function throwStyleConflict(scopeId: string): never {
  throw new Error(`Style conflict for ${scopeId}`);
}
