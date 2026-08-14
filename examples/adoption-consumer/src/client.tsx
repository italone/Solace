import {
  RouterLink,
  RouterView,
  createApp,
  createRouter,
  createWebHashHistory,
  ref,
} from "@italone/solace";

const count = ref(0);

const Home = () => () => (
  <main>
    <h1>Independent CSR consumer</h1>
    <button id="csr-count" onClick={() => (count.value += 1)}>
      count: {count.value}
    </button>
  </main>
);

const Details = () => <h1>Package-only route</h1>;

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/details", component: Details },
  ],
});

const App = () => (
  <div>
    <nav>
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/details">Details</RouterLink>
    </nav>
    <RouterView />
  </div>
);

const container = document.querySelector("#app");
if (!(container instanceof Element)) throw new Error("CSR root is missing");
createApp(App).use(router).mount(container);
