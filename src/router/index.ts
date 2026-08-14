export { RouterLink, RouterView } from "./components";
export { createMemoryHistory, createWebHashHistory, createWebHistory } from "./history";
export { lazyRoute } from "./lazy";
export { RouterNavigationError, createRouter, useRoute, useRouter } from "./router";
export {
  createRouterSnapshot,
  parseRouterSnapshot,
  RouterHydrationError,
  serializeRouterSnapshot,
  verifyRouterSnapshot,
} from "./snapshot";
export type { RouterLinkProps } from "./components";
export type { RouteRecordIdentity, RouterHydrationErrorField, RouterSnapshot } from "./snapshot";
export type {
  LazyRouteComponent,
  NavigationGuard,
  NavigationGuardResult,
  RouteComponent,
  RouteLocationNormalized,
  RouteLocationRaw,
  RouteParamInputValue,
  RouteParamsInput,
  RouteProps,
  RouteRecord,
  RouteRecordName,
  Router,
  RouterHistory,
  RouterOptions,
  RouterScrollBehavior,
  RouterScrollBehaviorResult,
  RouterScrollPosition,
} from "./types";
