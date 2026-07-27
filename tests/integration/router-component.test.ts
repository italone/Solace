import { describe, expect, it } from "vitest";

import {
  RouterLink,
  RouterView,
  createApp,
  createRouter,
  h,
  nextTick,
  useRoute,
} from "../../src/index";
import type { RouterHistory } from "../../src/router/types";

function createMemoryLikeHistory(initial = "/"): RouterHistory {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    location: () => current,
    push(path) {
      current = path;
    },
    replace(path) {
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
  };
}

describe("router components", () => {
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
          { to: { path: "/users/42", query: { tab: "profile" } }, id: "user-link" },
          "User",
        ),
        h(RouterView),
      ]);
    const container = document.createElement("div");

    createApp(App).use(router).mount(container);
    expect(container.querySelector("#home")?.textContent).toBe("home");

    container.querySelector<HTMLAnchorElement>("#user-link")?.click();
    expect(router.currentRoute.value.fullPath).toBe("/users/42?tab=profile");
    expect(router.currentRoute.value.matched?.component).toBe(User);
    await nextTick();

    expect(container.querySelector("#user")?.textContent).toBe("user:42:profile");
  });

  it("renders an empty fragment when no route matches", () => {
    const router = createRouter({ history: createMemoryLikeHistory("/missing"), routes: [] });
    const container = document.createElement("div");

    createApp(() => h(RouterView))
      .use(router)
      .mount(container);

    expect(container.innerHTML).toBe("");
  });
});
