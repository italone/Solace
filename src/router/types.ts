import type { App } from "../app";
import type { Ref } from "../reactivity/ref";
import type { ComponentType } from "../vnode/vnode";
import type { Query, QueryInput } from "./query";

export type RouteComponent = ComponentType | LazyRouteComponent;

export interface LazyRouteComponent {
  readonly __solaceLazyRouteComponent: true;
  load(): Promise<{ default: ComponentType } | ComponentType>;
}

export type NavigationGuardResult =
  void | boolean | RouteLocationRaw | Promise<void | boolean | RouteLocationRaw>;

export type NavigationGuard = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
) => NavigationGuardResult;

export interface RouteRecord {
  path: string;
  component?: RouteComponent;
  children?: RouteRecord[];
  redirect?: RouteLocationRaw | ((to: RouteLocationNormalized) => RouteLocationRaw);
  beforeEnter?: NavigationGuard | NavigationGuard[];
  meta?: Record<string, unknown>;
}

export interface RouteLocationNormalized {
  path: string;
  fullPath: string;
  query: Query;
  params: Record<string, string>;
  matched: RouteRecord[];
  redirectedFrom?: RouteLocationNormalized;
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
  push(to: RouteLocationRaw): Promise<RouteLocationNormalized>;
  replace(to: RouteLocationRaw): Promise<RouteLocationNormalized>;
  back(): void;
  forward(): void;
  resolve(to: RouteLocationRaw): RouteLocationNormalized;
  beforeEach(guard: NavigationGuard): () => void;
}
