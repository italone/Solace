import {
  RouterLink,
  RouterView,
  createApp,
  createRouter,
  createWebHashHistory,
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

const NotFound = () => <p id="not-found-view">not found</p>;

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/users/:id", component: User },
    { path: "/:pathMatch(.*)*", component: NotFound },
  ],
});

const App = () => () => (
  <main>
    <nav>
      <RouterLink id="home-link" to="/">
        Home
      </RouterLink>
      <RouterLink id="user-link" to={{ path: "/users/42", query: { tab: "profile" } }}>
        User
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
