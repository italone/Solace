import type { App } from "../app";
import type { Ref } from "../reactivity/ref";
import type { ComponentType } from "../vnode/vnode";
import type { Query, QueryInput } from "./query";

export interface RouteRecord {
  path: string;
  component: ComponentType;
}

export interface RouteLocationNormalized {
  path: string;
  fullPath: string;
  query: Query;
  params: Record<string, string>;
  matched: RouteRecord | null;
}

export type RouteLocationRaw = string | { path: string; query?: QueryInput };

export interface RouterHistory {
  location(): string;
  push(path: string): void;
  replace(path: string): void;
  listen(listener: () => void): () => void;
  back(): void;
  forward(): void;
}

export interface RouterOptions {
  history: RouterHistory;
  routes: RouteRecord[];
}

export interface Router {
  currentRoute: Ref<RouteLocationNormalized>;
  install(app: App): void;
  push(to: RouteLocationRaw): void;
  replace(to: RouteLocationRaw): void;
  back(): void;
  forward(): void;
  resolve(to: RouteLocationRaw): RouteLocationNormalized;
}
