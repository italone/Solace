import type { RouterHistory } from "./types";

export function createWebHistory(): RouterHistory {
  const location = () => `${window.location.pathname}${window.location.search}` || "/";

  return {
    location,
    push: (path) => window.history.pushState(null, "", path),
    replace: (path) => window.history.replaceState(null, "", path),
    listen(listener) {
      const onPopState = createLocationChangeListener(location, listener);
      window.addEventListener("popstate", onPopState);
      return () => window.removeEventListener("popstate", onPopState);
    },
    back: () => window.history.back(),
    forward: () => window.history.forward(),
  };
}

export function createWebHashHistory(): RouterHistory {
  const location = () => normalizeHashLocation(window.location.hash);

  return {
    location,
    push: (path) => window.history.pushState(null, "", `#${normalizeHashTarget(path)}`),
    replace: (path) => window.history.replaceState(null, "", `#${normalizeHashTarget(path)}`),
    listen(listener) {
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
  if (path === "" || path === "/") {
    return "/";
  }

  return path.startsWith("/") ? path : `/${path}`;
}
