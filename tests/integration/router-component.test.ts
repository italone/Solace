import { describe, expect, it } from "vitest";

import {
  RouterLink,
  RouterNavigationError,
  RouterView,
  createApp,
  createRouter,
  h,
  lazyRoute,
  nextTick,
  useRoute,
} from "../../src/index";
import type { RouterHistory } from "../../src/router/types";

function createMemoryLikeHistory(initial = "/"): RouterHistory & {
  pushedPaths: string[];
  replacedPaths: string[];
} {
  let current = initial;
  const listeners = new Set<() => void>();
  const pushedPaths: string[] = [];
  const replacedPaths: string[] = [];
  return {
    location: () => current,
    push(path) {
      pushedPaths.push(path);
      current = path;
    },
    replace(path) {
      replacedPaths.push(path);
      current = path;
    },
    listen(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    back() {
      current = "/";
      for (const listener of listeners) listener();
    },
    forward() {},
    pushedPaths,
    replacedPaths,
  };
}

async function settleRouterLinkNavigation(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await nextTick();
}

async function settleLazyRouteComponent(): Promise<void> {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();
}

describe("router components", () => {
  it("renders nested RouterView depth for parent and child records", async () => {
    const DashboardLayout = () => () =>
      h("section", { id: "layout" }, [h("h1", null, "Dashboard"), h(RouterView)]);
    const Settings = () => h("p", { id: "settings" }, "settings");
    const router = createRouter({
      history: createMemoryLikeHistory("/dashboard/settings"),
      routes: [
        {
          path: "/dashboard",
          component: DashboardLayout,
          children: [{ path: "settings", component: Settings }],
        },
      ],
    });
    const container = document.createElement("div");

    createApp(() => h(RouterView))
      .use(router)
      .mount(container);
    await nextTick();

    expect(container.querySelector("#layout h1")?.textContent).toBe("Dashboard");
    expect(container.querySelector("#settings")?.textContent).toBe("settings");
  });

  it("renders index children under parent layouts", async () => {
    const DashboardLayout = () => () => h("section", { id: "layout" }, h(RouterView));
    const DashboardHome = () => h("p", { id: "home" }, "dashboard-home");
    const router = createRouter({
      history: createMemoryLikeHistory("/dashboard"),
      routes: [
        {
          path: "/dashboard",
          component: DashboardLayout,
          children: [{ path: "", component: DashboardHome }],
        },
      ],
    });
    const container = document.createElement("div");

    createApp(() => h(RouterView))
      .use(router)
      .mount(container);
    await nextTick();

    expect(container.querySelector("#home")?.textContent).toBe("dashboard-home");
  });

  it("does not consume RouterView depth for layout-less grouping records", async () => {
    const Settings = () => h("p", { id: "settings" }, "settings");
    const router = createRouter({
      history: createMemoryLikeHistory("/admin/settings"),
      routes: [
        {
          path: "/admin",
          children: [{ path: "settings", component: Settings }],
        },
      ],
    });
    const container = document.createElement("div");

    createApp(() => h(RouterView))
      .use(router)
      .mount(container);
    await nextTick();

    expect(container.querySelector("#settings")?.textContent).toBe("settings");
  });

  it("renders the matched route and updates after RouterLink click", async () => {
    const Home = () => h("p", { id: "home" }, "home");
    const User = () => {
      const route = useRoute();
      return () => h("p", { id: "user" }, `user:${route.value.params.id}:${route.value.query.tab}`);
    };
    const router = createRouter({
      history: createMemoryLikeHistory("/"),
      routes: [
        { path: "/", component: Home },
        { path: "/users/:id", component: User },
      ],
    });
    const App = () => () =>
      h("main", null, [
        h(
          RouterLink,
          {
            to: { path: "/users/42", query: { tab: "profile" } },
            id: "user-link",
            target: "_self",
          },
          "User",
        ),
        h(RouterView),
      ]);
    const container = document.createElement("div");

    createApp(App).use(router).mount(container);
    expect(container.querySelector("#home")?.textContent).toBe("home");

    container.querySelector<HTMLAnchorElement>("#user-link")?.click();
    await settleRouterLinkNavigation();
    expect(router.currentRoute.value.fullPath).toBe("/users/42?tab=profile");
    expect(router.currentRoute.value.matched[0]?.component).toBe(User);

    expect(container.querySelector("#user")?.textContent).toBe("user:42:profile");
  });

  it("renders RouterLink hrefs from resolved full paths", () => {
    const router = createRouter({
      history: createMemoryLikeHistory("/"),
      routes: [{ path: "/users/:id", component: () => h("p", null, "user") }],
    });
    const App = () => () =>
      h("nav", null, [
        h(RouterLink, { to: "/users/42///?tab=profile", id: "string-link" }, "String"),
        h(
          RouterLink,
          { to: { path: "users/7///", query: { tab: "profile" } }, id: "object-link" },
          "Object",
        ),
        h(
          RouterLink,
          { to: { path: "/users/8", query: { tag: ["a", "b"] } }, id: "array-link" },
          "Array",
        ),
      ]);
    const container = document.createElement("div");

    createApp(App).use(router).mount(container);

    expect(container.querySelector<HTMLAnchorElement>("#string-link")?.getAttribute("href")).toBe(
      "/users/42?tab=profile",
    );
    expect(container.querySelector<HTMLAnchorElement>("#object-link")?.getAttribute("href")).toBe(
      "/users/7?tab=profile",
    );
    expect(container.querySelector<HTMLAnchorElement>("#array-link")?.getAttribute("href")).toBe(
      "/users/8?tag=a&tag=b",
    );
  });

  it("renders an empty fragment when no route matches", () => {
    const router = createRouter({ history: createMemoryLikeHistory("/missing"), routes: [] });
    const container = document.createElement("div");

    createApp(() => h(RouterView))
      .use(router)
      .mount(container);

    expect(container.innerHTML).toBe("");
  });

  it("renders an empty fragment for a null matched component", () => {
    const router = createRouter({
      history: createMemoryLikeHistory("/null"),
      routes: [{ path: "/null", component: null }] as never,
    });
    const container = document.createElement("div");

    expect(() =>
      createApp(() => h(RouterView))
        .use(router)
        .mount(container),
    ).not.toThrow();
    expect(container.innerHTML).toBe("");
  });

  it("renders lazy route components after they resolve", async () => {
    let resolveLoader!: (component: () => ReturnType<typeof h>) => void;
    const LazyUser = lazyRoute(
      () =>
        new Promise<() => ReturnType<typeof h>>((resolve) => {
          resolveLoader = resolve;
        }),
    );
    const router = createRouter({
      history: createMemoryLikeHistory("/lazy"),
      routes: [{ path: "/lazy", component: LazyUser }],
    });
    const container = document.createElement("div");

    createApp(() => h(RouterView))
      .use(router)
      .mount(container);

    expect(container.innerHTML).toBe("");

    resolveLoader(() => h("p", { id: "lazy-user" }, "lazy-user"));
    await settleLazyRouteComponent();

    expect(container.querySelector("#lazy-user")?.textContent).toBe("lazy-user");
  });

  it("renders lazy default exports after they resolve", async () => {
    const LazyUser = lazyRoute(() =>
      Promise.resolve({ default: () => h("p", { id: "lazy-default" }, "lazy-default") }),
    );
    const router = createRouter({
      history: createMemoryLikeHistory("/lazy-default"),
      routes: [{ path: "/lazy-default", component: LazyUser }],
    });
    const container = document.createElement("div");

    createApp(() => h(RouterView))
      .use(router)
      .mount(container);
    await settleLazyRouteComponent();

    expect(container.querySelector("#lazy-default")?.textContent).toBe("lazy-default");
  });

  it("renders nested lazy route components after navigation", async () => {
    const DashboardLayout = () => () => h("section", { id: "layout" }, h(RouterView));
    const Settings = () => h("p", { id: "settings" }, "settings");
    let loadCalls = 0;
    const LazyReport = lazyRoute(() => {
      loadCalls += 1;
      return Promise.resolve(() => h("p", { id: "lazy-report" }, "lazy-report"));
    });
    const router = createRouter({
      history: createMemoryLikeHistory("/dashboard/settings"),
      routes: [
        {
          path: "/dashboard",
          component: DashboardLayout,
          children: [
            { path: "settings", component: Settings },
            { path: "report", component: LazyReport },
          ],
        },
      ],
    });
    const container = document.createElement("div");

    createApp(() => h(RouterView))
      .use(router)
      .mount(container);
    await nextTick();
    expect(container.querySelector("#settings")?.textContent).toBe("settings");

    await router.push("/dashboard/report");
    await nextTick();
    expect(loadCalls).toBe(1);
    await settleLazyRouteComponent();

    expect(container.querySelector("#lazy-report")?.textContent).toBe("lazy-report");
  });

  it("surfaces a router error when a lazy route component fails to load", async () => {
    const router = createRouter({
      history: createMemoryLikeHistory("/lazy-error"),
      routes: [
        {
          path: "/lazy-error",
          component: lazyRoute(() => Promise.reject(new Error("load failed"))),
        },
      ],
    });
    const container = document.createElement("div");
    let capturedError: unknown = null;
    const onUnhandledRejection = (reason: unknown) => {
      if (reason instanceof RouterNavigationError) {
        capturedError = reason;
      }
    };

    process.on("unhandledRejection", onUnhandledRejection);
    try {
      createApp(() => h(RouterView))
        .use(router)
        .mount(container);

      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(capturedError).toMatchObject({
        name: "RouterNavigationError",
        type: "lazy-load-failed",
        from: { fullPath: "/lazy-error" },
        to: { fullPath: "/lazy-error" },
      });
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }
  });

  it("reports the active route when a shared lazy component fails after navigation", async () => {
    const SharedLazyRoute = lazyRoute(() => Promise.reject(new Error("load failed")));
    const router = createRouter({
      history: createMemoryLikeHistory("/first-lazy"),
      routes: [
        { path: "/first-lazy", component: SharedLazyRoute },
        { path: "/second-lazy", component: SharedLazyRoute },
      ],
    });
    const container = document.createElement("div");
    const capturedErrors: RouterNavigationError[] = [];
    const onUnhandledRejection = (reason: unknown) => {
      if (reason instanceof RouterNavigationError) {
        capturedErrors.push(reason);
      }
    };

    process.on("unhandledRejection", onUnhandledRejection);
    try {
      createApp(() => h(RouterView))
        .use(router)
        .mount(container);

      await settleLazyRouteComponent();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await router.push("/second-lazy");
      await settleLazyRouteComponent();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(capturedErrors[capturedErrors.length - 1]).toMatchObject({
        name: "RouterNavigationError",
        type: "lazy-load-failed",
        from: { fullPath: "/second-lazy" },
        to: { fullPath: "/second-lazy" },
      });
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }
  });

  it("does not navigate RouterLink clicks that the browser should handle", () => {
    const history = createMemoryLikeHistory("/");
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: () => h("p", null, "home") },
        { path: "/users/:id", component: () => h("p", null, "user") },
      ],
    });
    const App = () => () =>
      h("main", null, [
        h(RouterLink, { to: "/users/42", id: "meta-link" }, "Meta"),
        h(
          RouterLink,
          {
            to: "/users/43",
            id: "prevented-link",
            onClick: (event: MouseEvent) => event.preventDefault(),
          },
          "Prevented",
        ),
        h(RouterView),
      ]);
    const container = document.createElement("div");

    createApp(App).use(router).mount(container);
    container
      .querySelector<HTMLAnchorElement>("#meta-link")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true }));
    container.querySelector<HTMLAnchorElement>("#prevented-link")?.click();

    expect(history.pushedPaths).toEqual([]);
    expect(router.currentRoute.value.fullPath).toBe("/");
  });

  it("leaves RouterLink clicks with non-self targets to the browser", async () => {
    const history = createMemoryLikeHistory("/");
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: () => h("p", null, "home") },
        { path: "/users/:id", component: () => h("p", null, "user") },
      ],
    });
    const App = () => () =>
      h("main", null, [
        h(RouterLink, { to: "/users/42", id: "blank-link", target: "_blank" }, "Blank"),
        h(RouterLink, { to: "/users/43", id: "named-link", target: "preview" }, "Preview"),
        h(RouterView),
      ]);
    const container = document.createElement("div");

    createApp(App).use(router).mount(container);
    const blankLink = container.querySelector<HTMLAnchorElement>("#blank-link");
    const namedLink = container.querySelector<HTMLAnchorElement>("#named-link");
    let blankWasPreventedBeforeBrowserDefault = true;
    let namedWasPreventedBeforeBrowserDefault = true;
    blankLink?.addEventListener("click", (event) => {
      blankWasPreventedBeforeBrowserDefault = event.defaultPrevented;
      event.preventDefault();
    });
    namedLink?.addEventListener("click", (event) => {
      namedWasPreventedBeforeBrowserDefault = event.defaultPrevented;
      event.preventDefault();
    });
    const blankEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
    const namedEvent = new MouseEvent("click", { bubbles: true, cancelable: true });

    blankLink?.dispatchEvent(blankEvent);
    namedLink?.dispatchEvent(namedEvent);
    await settleRouterLinkNavigation();

    expect(blankWasPreventedBeforeBrowserDefault).toBe(false);
    expect(namedWasPreventedBeforeBrowserDefault).toBe(false);
    expect(history.pushedPaths).toEqual([]);
    expect(router.currentRoute.value.fullPath).toBe("/");
  });

  it("leaves RouterLink clicks with download to the browser", async () => {
    const history = createMemoryLikeHistory("/");
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: () => h("p", null, "home") },
        { path: "/download", component: () => h("p", null, "download") },
      ],
    });
    const App = () => () =>
      h("main", null, [
        h(RouterLink, { to: "/download", download: "report.txt", id: "download-link" }, "Download"),
        h(RouterView),
      ]);
    const container = document.createElement("div");

    createApp(App).use(router).mount(container);
    const downloadLink = container.querySelector<HTMLAnchorElement>("#download-link");
    let wasPreventedBeforeBrowserDefault = true;
    downloadLink?.addEventListener("click", (event) => {
      wasPreventedBeforeBrowserDefault = event.defaultPrevented;
      event.preventDefault();
    });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });

    downloadLink?.dispatchEvent(event);
    await settleRouterLinkNavigation();

    expect(wasPreventedBeforeBrowserDefault).toBe(false);
    expect(history.pushedPaths).toEqual([]);
    expect(router.currentRoute.value.fullPath).toBe("/");
  });

  it("uses replace navigation when RouterLink replace is true", async () => {
    const history = createMemoryLikeHistory("/");
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: () => h("p", { id: "home" }, "home") },
        { path: "/users/:id", component: () => h("p", { id: "user" }, "user") },
      ],
    });
    const App = () => () =>
      h("main", null, [
        h(RouterLink, { to: "/users/99", id: "replace-link", replace: true }, "Replace"),
        h(RouterView),
      ]);
    const container = document.createElement("div");

    createApp(App).use(router).mount(container);
    container.querySelector<HTMLAnchorElement>("#replace-link")?.click();
    await settleRouterLinkNavigation();

    expect(history.pushedPaths).toEqual([]);
    expect(history.replacedPaths).toEqual(["/users/99"]);
    expect(container.querySelector("#user")?.textContent).toBe("user");
  });
});
