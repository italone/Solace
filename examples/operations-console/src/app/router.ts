import { createRouter, createWebHashHistory, lazyRoute } from "@italone/solace";

import { NotFoundPage } from "../features/NotFoundPage";
import { IncidentDetailPage } from "../features/incidents/IncidentDetailPage";
import { IncidentQueuePage } from "../features/incidents/IncidentQueuePage";
import { OverviewPage } from "../features/overview/OverviewPage";

export const operationsRouter = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      name: "overview",
      component: OverviewPage,
      meta: { title: "Operations overview" },
    },
    {
      path: "/incidents",
      name: "incidents",
      component: IncidentQueuePage,
    },
    {
      path: "/incidents/:id",
      name: "incident-detail",
      component: IncidentDetailPage,
      props: true,
    },
    {
      path: "/legacy-incidents",
      redirect: "/incidents",
    },
    {
      path: "/releases",
      name: "releases",
      component: lazyRoute(() => import("../features/releases/ReleaseActivityPage")),
    },
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: NotFoundPage,
    },
  ],
  scrollBehavior: () => ({ left: 0, top: 0 }),
});
