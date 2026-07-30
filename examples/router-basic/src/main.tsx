import {
  RouterLink,
  RouterView,
  createApp,
  createRouter,
  createWebHashHistory,
  lazyRoute,
  useRoute,
} from "@italone/solace";

const Home = () => <p id="home-view">home</p>;

const User = () => {
  const route = useRoute();

  return () => (
    <p id="user-view">
      user: {route.value.params.id} tab: {String(route.value.query.tab)}
    </p>
  );
};

const DashboardLayout = () => () => (
  <section id="dashboard-view">
    <h2>Dashboard</h2>
    <nav>
      <RouterLink id="dashboard-home-link" to="/dashboard">
        Dashboard Home
      </RouterLink>
      <RouterLink id="settings-link" to="/dashboard/settings">
        Settings
      </RouterLink>
      <RouterLink id="report-link" to="/dashboard/report">
        Report
      </RouterLink>
    </nav>
    <RouterView />
  </section>
);

const DashboardHome = () => <p id="dashboard-home-view">dashboard home</p>;
const Settings = () => <p id="settings-view">settings</p>;
let authenticated = false;
const Login = () => () => (
  <section>
    <p id="login-view">login</p>
    <button
      id="sign-in-button"
      type="button"
      onClick={() => {
        authenticated = true;
        router.push("/dashboard");
      }}
    >
      Sign in
    </button>
  </section>
);
const LazyReport = lazyRoute(() => Promise.resolve(() => <p id="lazy-report-view">lazy report</p>));
const NotFound = () => <p id="not-found-view">not found</p>;

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/old-home", redirect: "/" },
    { path: "/users/:id", component: User },
    { path: "/login", component: Login },
    {
      path: "/dashboard",
      component: DashboardLayout,
      beforeEnter: () => authenticated || "/login",
      meta: { requiresAuth: true },
      children: [
        { path: "", component: DashboardHome },
        { path: "settings", component: Settings },
        { path: "report", component: LazyReport },
      ],
    },
    { path: "/:pathMatch(.*)*", component: NotFound },
  ],
});

const App = () => () => (
  <main>
    <nav>
      <RouterLink id="home-link" to="/">
        Home
      </RouterLink>
      <RouterLink id="legacy-link" to="/old-home">
        Legacy Home
      </RouterLink>
      <RouterLink id="user-link" to={{ path: "/users/42", query: { tab: "profile" } }}>
        User
      </RouterLink>
      <RouterLink id="dashboard-link" to="/dashboard">
        Dashboard
      </RouterLink>
      <RouterLink id="missing-link" to="/missing">
        Missing
      </RouterLink>
    </nav>
    <RouterView />
  </main>
);

createApp(App)
  .use(router)
  .mount(document.querySelector("#app") as Element);
