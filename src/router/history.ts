import type { RouterHistory } from "./types";

export function createWebHistory(): RouterHistory {
  return {
    location: () => `${window.location.pathname}${window.location.search}` || "/",
    push: (path) => window.history.pushState(null, "", path),
    replace: (path) => window.history.replaceState(null, "", path),
    listen(listener) {
      window.addEventListener("popstate", listener);
      return () => window.removeEventListener("popstate", listener);
    },
    back: () => window.history.back(),
    forward: () => window.history.forward(),
  };
}

export function createWebHashHistory(): RouterHistory {
  return {
    location: () => normalizeHashLocation(window.location.hash),
    push: (path) => window.history.pushState(null, "", `#${normalizeHashTarget(path)}`),
    replace: (path) => window.history.replaceState(null, "", `#${normalizeHashTarget(path)}`),
    listen(listener) {
      window.addEventListener("popstate", listener);
      window.addEventListener("hashchange", listener);
      return () => {
        window.removeEventListener("popstate", listener);
        window.removeEventListener("hashchange", listener);
      };
    },
    back: () => window.history.back(),
    forward: () => window.history.forward(),
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
