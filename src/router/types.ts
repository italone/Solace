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

export type RouteRecordName = string;
export type RouteParamInputValue = string | number;
export type RouteParamsInput = Record<string, RouteParamInputValue>;
export type RouteProps =
  boolean | Record<string, unknown> | ((route: RouteLocationNormalized) => Record<string, unknown>);

export interface RouterScrollPosition {
  left?: number;
  top?: number;
  behavior?: ScrollBehavior;
}

export type RouterScrollBehaviorResult = void | false | RouterScrollPosition;

export type RouterScrollBehavior = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
) => RouterScrollBehaviorResult | Promise<RouterScrollBehaviorResult>;

export interface RouteRecord {
  path: string;
  name?: RouteRecordName;
  component?: RouteComponent | null;
  children?: RouteRecord[];
  redirect?: RouteLocationRaw | ((to: RouteLocationNormalized) => RouteLocationRaw);
  beforeEnter?: NavigationGuard | NavigationGuard[];
  meta?: Record<string, unknown>;
  alias?: string | string[];
  props?: RouteProps;
}

export interface RouteLocationNormalized {
  path: string;
  fullPath: string;
  query: Query;
  params: Record<string, string>;
  matched: RouteRecord[];
  name?: RouteRecordName;
  redirectedFrom?: RouteLocationNormalized;
}

export type RouteLocationRaw =
  | string
  | { path: string; name?: never; params?: never; query?: QueryInput }
  | { name: RouteRecordName; path?: never; params?: RouteParamsInput; query?: QueryInput };

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
  scrollBehavior?: RouterScrollBehavior;
}

export interface Router {
  currentRoute: Ref<RouteLocationNormalized>;
  install(app: App): void;
  isReady(): Promise<RouteLocationNormalized>;
  push(to: RouteLocationRaw): Promise<RouteLocationNormalized>;
  replace(to: RouteLocationRaw): Promise<RouteLocationNormalized>;
  back(): void;
  forward(): void;
  resolve(to: RouteLocationRaw): RouteLocationNormalized;
  beforeEach(guard: NavigationGuard): () => void;
}
