import { RouterView, h } from "@italone/solace";
import type { RouteRecord } from "@italone/solace";
import {
  createRouterServerContext,
  renderToString,
  renderToStringAsync,
  serializeRouterSnapshot,
} from "@italone/solace/server";

const Home = () => () => <main id="router-home">home</main>;
const Target = () => () => <main id="router-target">target</main>;
const routes: RouteRecord[] = [
  { path: "/", name: "home", component: Home },
  { path: "/target", name: "target", component: Target },
  { path: "/legacy", redirect: "/target" },
];
const identifyRecord = (record: RouteRecord): string => record.name ?? record.path;
const RouterApp = () => (
  <div id="router-shell">
    <RouterView />
  </div>
);

export async function runAdoptionServerScenario() {
  const sync = renderToString(<button id="hydration-count">count: 1</button>);
  const asyncResult = await renderToStringAsync(
    Promise.resolve(h("p", { id: "async-server-output" }, "async server output")),
  );
  const routerContext = await createRouterServerContext({
    url: "/legacy",
    routes,
    identifyRecord,
  });
  const routerResult = await renderToStringAsync(RouterApp, {
    provides: routerContext.provides,
  });

  return {
    asyncHtml: asyncResult.html,
    routerHtml: routerResult.html,
    routerSnapshot: serializeRouterSnapshot(routerContext.snapshot),
    syncHtml: sync.html,
  };
}
