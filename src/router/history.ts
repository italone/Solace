import { historyHrefFormatterKey } from "./internal";
import type { RouterHistory } from "./types";

export function createMemoryHistory(initial: string | string[] = "/"): RouterHistory {
  const entries = normalizeMemoryHistoryEntries(initial);
  let index = entries.length - 1;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const history = {
    location: () => entries[index] ?? "/",
    [historyHrefFormatterKey]: (path: string) => normalizeHistoryTarget(path),
    push(path: string) {
      const next = normalizeHistoryTarget(path);
      entries.splice(index + 1, entries.length - index - 1, next);
      index = entries.length - 1;
      notify();
    },
    replace(path: string) {
      entries[index] = normalizeHistoryTarget(path);
      notify();
    },
    listen(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    back() {
      if (index === 0) {
        return;
      }

      index -= 1;
      notify();
    },
    forward() {
      if (index >= entries.length - 1) {
        return;
      }

      index += 1;
      notify();
    },
  };

  return history;
}

export function createWebHistory(): RouterHistory {
  const location = () =>
    normalizeHistoryTarget(`${window.location.pathname}${window.location.search}`);

  const history = {
    location,
    [historyHrefFormatterKey]: (path: string) => normalizeHistoryTarget(path),
    push: (path: string) => window.history.pushState(null, "", normalizeHistoryTarget(path)),
    replace: (path: string) => window.history.replaceState(null, "", normalizeHistoryTarget(path)),
    listen(listener: () => void) {
      const onPopState = createLocationChangeListener(location, listener);
      window.addEventListener("popstate", onPopState);
      return () => window.removeEventListener("popstate", onPopState);
    },
    back: () => window.history.back(),
    forward: () => window.history.forward(),
  };

  return history;
}

export function createWebHashHistory(): RouterHistory {
  const location = () => normalizeHashLocation(window.location.hash);

  const history = {
    location,
    [historyHrefFormatterKey]: (path: string) => `#${normalizeHashTarget(path)}`,
    push: (path: string) => window.history.pushState(null, "", `#${normalizeHashTarget(path)}`),
    replace: (path: string) =>
      window.history.replaceState(null, "", `#${normalizeHashTarget(path)}`),
    listen(listener: () => void) {
      const onHistoryChange = createLocationChangeListener(location, listener);
      window.addEventListener("popstate", onHistoryChange);
      window.addEventListener("hashchange", onHistoryChange);
      return () => {
        window.removeEventListener("popstate", onHistoryChange);
        window.removeEventListener("hashchange", onHistoryChange);
      };
    },
    back: () => window.history.back(),
    forward: () => window.history.forward(),
  };

  return history;
}

function createLocationChangeListener(location: () => string, listener: () => void): () => void {
  let lastLocation = location();

  return () => {
    const nextLocation = location();
    if (nextLocation === lastLocation) {
      return;
    }

    lastLocation = nextLocation;
    listener();
  };
}

function normalizeHashLocation(hash: string): string {
  const value = hash.startsWith("#") ? hash.slice(1) : hash;
  return normalizeHashTarget(value);
}

function normalizeHashTarget(path: string): string {
  return normalizeHistoryTarget(path);
}

function normalizeMemoryHistoryEntries(initial: string | string[]): string[] {
  const rawEntries = Array.isArray(initial) ? initial : [initial];
  const normalized = rawEntries.map((entry) => normalizeHistoryTarget(entry));
  return normalized.length === 0 ? ["/"] : normalized;
}

function normalizeHistoryTarget(path: string): string {
  if (path.startsWith("//") || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(path)) {
    throw new TypeError("Router history target must be a relative path");
  }

  if (path.includes("#")) {
    throw new TypeError("Router history target must not include hash fragments");
  }

  const queryStart = path.indexOf("?");
  const rawPath = queryStart >= 0 ? path.slice(0, queryStart) : path;
  const query = queryStart >= 0 ? path.slice(queryStart) : "";
  const withLeadingSlash = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const trimmed =
    withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, "") : withLeadingSlash;

  return `${trimmed === "" ? "/" : trimmed}${query}`;
}
