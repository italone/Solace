import {
  RouterView,
  createApp,
  createRouter,
  createRouterSnapshot,
  createWebHashHistory,
  parseRouterSnapshot,
  verifyRouterSnapshot,
} from "@italone/solace";
import type { RouteRecord } from "@italone/solace";

let setupEntered = false;
const Home = () => () => <main id="router-home">home</main>;
const Target = () => {
  setupEntered = true;
  return () => <main id="router-target">target</main>;
};
const routes: RouteRecord[] = [
  { path: "/", name: "home", component: Home },
  { path: "/target", name: "target", component: Target },
  { path: "/legacy", redirect: "/target" },
];
const identifyRecord = (record: RouteRecord): string => record.name ?? record.path;
const App = () => (
  <div id="router-shell">
    <RouterView />
  </div>
);

function requireElement(selector: string): Element {
  const element = document.querySelector(selector);
  if (!(element instanceof Element)) throw new Error(`Missing router element: ${selector}`);
  return element;
}

const snapshotElement = requireElement("#router-snapshot");
const serverSnapshot = parseRouterSnapshot(snapshotElement.textContent ?? "");
const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
const app = createApp(App).use(router);
const root = requireElement("#router-root");
const serverNode = root.firstElementChild;

await router.isReady();
const clientSnapshot = createRouterSnapshot(router.currentRoute.value, identifyRecord);
verifyRouterSnapshot(serverSnapshot, clientSnapshot);
const mismatchSnapshot = createRouterSnapshot(router.currentRoute.value, () => "mismatch");
try {
  verifyRouterSnapshot(serverSnapshot, mismatchSnapshot);
} catch {
  requireElement("#router-mismatch-status").textContent = setupEntered
    ? "router mismatch blocked after setup"
    : "router mismatch blocked before setup";
}

await app.hydrateAsync(root);
requireElement("#router-match-status").textContent =
  root.firstElementChild === serverNode && setupEntered
    ? "router DOM reused"
    : "router DOM replaced";
