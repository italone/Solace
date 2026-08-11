import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

import {
  RouterView,
  createApp,
  createMemoryHistory,
  createRouter,
  h,
  nextTick,
} from "@italone/solace";
import { operationsRouter } from "../../examples/operations-console/src/app/router";
import {
  createOperationsStore,
  operationsStore,
} from "../../examples/operations-console/src/app/store";
import { runAsyncRenderingScenario } from "../../examples/operations-console/src/entries/server-async";
import { runCoreRenderingScenario } from "../../examples/operations-console/src/entries/server-core";
import { IncidentDetailPage } from "../../examples/operations-console/src/features/incidents/IncidentDetailPage";
import { IncidentQueuePage } from "../../examples/operations-console/src/features/incidents/IncidentQueuePage";
import { RecoverableReleasePanel } from "../../examples/operations-console/src/features/releases/ReleaseActivityPage";
import { Layout } from "../../examples/operations-console/src/shared/Layout";

describe("operations console server entries", () => {
  it("renders the beta.2-compatible server scenario", () => {
    const result = runCoreRenderingScenario();
    const expectedPages = {
      "/": { label: "Open incidents", count: "3" },
      "/incidents/INC-1042": { label: "Critical incidents", count: "1" },
    } as const;
    const expectedStyle = result.rendered.styles[0];

    expect(result.rendered.html).toContain("Open incidents");
    expect(result.rendered.styles).toHaveLength(1);
    expect(result.site.pages.map((page) => page.path)).toEqual(["/", "/incidents/INC-1042"]);

    for (const page of result.site.pages) {
      const document = new DOMParser().parseFromString(page.html, "text/html");
      const expected = expectedPages[page.path as keyof typeof expectedPages];
      const styles = document.head.querySelectorAll("style");
      const stylesheets = document.head.querySelectorAll('link[rel="stylesheet"]');
      const bodyScripts = document.body.querySelectorAll("script");
      const summary = document.body.querySelector<HTMLElement>("[data-operations-summary]");
      const script = bodyScripts[0];

      expect(document.documentElement.localName).toBe("html");
      expect(Array.from(document.documentElement.children, (child) => child.localName)).toEqual([
        "head",
        "body",
      ]);
      expect(page.styles).toEqual([expectedStyle]);
      expect(styles).toHaveLength(1);
      expect(styles[0]?.outerHTML).toBe(expectedStyle);
      expect(stylesheets).toHaveLength(1);
      expect(stylesheets[0]?.getAttribute("href")).toBe("/assets/operations.css");
      expect(document.head.querySelectorAll("script")).toHaveLength(0);
      expect(bodyScripts).toHaveLength(1);
      expect(script?.getAttribute("type")).toBe("module");
      expect(script?.getAttribute("src")).toBe("/assets/hydration.js");
      expect(summary).not.toBeNull();
      expect(summary?.nextElementSibling).toBe(script);
      expect(summary?.querySelector(".operations-summary__label")?.textContent).toBe(
        expected.label,
      );
      expect(summary?.querySelector(".operations-summary__count")?.textContent).toBe(
        expected.count,
      );
    }
  });

  it("preserves async route output order", async () => {
    await expect(runAsyncRenderingScenario()).resolves.toMatchObject({
      rendered: { html: expect.stringContaining("Async operations snapshot") },
      paths: ["/async-overview", "/async-incident"],
    });
  });

  it("keeps matching hydration markup aligned with server output", async () => {
    const fixture = await readFile("examples/operations-console/hydration.html", "utf8");
    const document = new DOMParser().parseFromString(fixture, "text/html");
    const matchingRoots = document.querySelectorAll("#matching-root");

    expect(matchingRoots).toHaveLength(1);
    expect(matchingRoots[0]?.innerHTML).toBe(runCoreRenderingScenario().hydrationBody);
  });

  it("keeps the hydration fixture style aligned with server output", async () => {
    const fixture = await readFile("examples/operations-console/hydration.html", "utf8");
    const document = new DOMParser().parseFromString(fixture, "text/html");
    const result = runCoreRenderingScenario();
    const styles = document.head.querySelectorAll(
      'style[data-s-id="operations-console-incident-summary"]',
    );

    expect(result.rendered.styles).toHaveLength(1);
    expect(styles).toHaveLength(1);
    expect(styles[0]?.outerHTML).toBe(result.rendered.styles[0]);
  });
});

describe("operations console routes", () => {
  it("resolves the console route contracts", () => {
    const incidentDetail = operationsRouter.resolve({
      name: "incident-detail",
      params: { id: "INC-1042" },
    });
    const legacyIncidents = operationsRouter.resolve("/legacy-incidents");
    const releases = operationsRouter.resolve("/releases");
    const missing = operationsRouter.resolve("/missing");

    expect(incidentDetail).toMatchObject({
      path: "/incidents/INC-1042",
      name: "incident-detail",
      params: { id: "INC-1042" },
    });
    expect(legacyIncidents.matched[legacyIncidents.matched.length - 1]?.redirect).toBe(
      "/incidents",
    );
    expect(releases.name).toBe("releases");
    expect(missing.name).toBe("not-found");
  });

  it("updates incident detail when navigating between incident params", async () => {
    const PlaceholderPage = () => h("p", null, "placeholder");
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", name: "overview", component: PlaceholderPage },
        { path: "/incidents", name: "incidents", component: PlaceholderPage },
        {
          path: "/incidents/:id",
          name: "incident-detail",
          component: IncidentDetailPage,
          props: true,
        },
        { path: "/releases", name: "releases", component: PlaceholderPage },
      ],
    });
    const container = document.createElement("div");

    createApp(() => h(Layout, null, h(RouterView)))
      .use(router)
      .mount(container);

    await router.push("/incidents/INC-1042");
    await nextTick();
    expect(container.querySelector("#incident-detail-heading")?.textContent).toContain("INC-1042");

    await router.push("/incidents/INC-1039");
    await nextTick();
    expect(container.querySelector("#incident-detail-heading")?.textContent).toContain("INC-1039");
    expect(container.textContent).toContain("Delayed webhook delivery");
  });

  it("marks the current operations section in navigation", async () => {
    const PlaceholderPage = () => h("p", null, "placeholder");
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", name: "overview", component: PlaceholderPage },
        { path: "/incidents", name: "incidents", component: PlaceholderPage },
        {
          path: "/incidents/:id",
          name: "incident-detail",
          component: IncidentDetailPage,
          props: true,
        },
        { path: "/releases", name: "releases", component: PlaceholderPage },
      ],
    });
    const container = document.createElement("div");
    const currentNavigationLabel = () => {
      const currentLinks = container.querySelectorAll('.console-nav a[aria-current="page"]');

      expect(currentLinks).toHaveLength(1);
      return currentLinks[0]?.textContent;
    };

    createApp(() => h(Layout, null, h(RouterView)))
      .use(router)
      .mount(container);
    await nextTick();
    expect(currentNavigationLabel()).toBe("Overview");

    await router.push("/incidents/INC-1042");
    await nextTick();
    expect(currentNavigationLabel()).toBe("Incidents");

    await router.push("/releases");
    await nextTick();
    expect(currentNavigationLabel()).toBe("Releases");
  });

  it("renders and updates incident status select values", async () => {
    const PlaceholderPage = () => h("p", null, "placeholder");
    const router = createRouter({
      history: createMemoryHistory("/incidents"),
      routes: [
        { path: "/incidents", name: "incidents", component: IncidentQueuePage },
        {
          path: "/incidents/:id",
          name: "incident-detail",
          component: PlaceholderPage,
        },
      ],
    });
    const container = document.createElement("div");
    const getStatusSelect = (id: string) => {
      const select = container.querySelector<HTMLSelectElement>(`#status-${id}`);

      expect(select).not.toBeNull();
      return select as HTMLSelectElement;
    };
    const originalStatus = operationsStore.state.incidents.find(
      (incident) => incident.id === "INC-1042",
    )?.status;

    createApp(() => h(RouterView))
      .use(router)
      .mount(container);
    await nextTick();

    try {
      expect(getStatusSelect("INC-1042").value).toBe("investigating");
      expect(getStatusSelect("INC-1039").value).toBe("monitoring");
      expect(getStatusSelect("INC-1031").value).toBe("resolved");

      const select = getStatusSelect("INC-1042");
      select.value = "monitoring";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await nextTick();

      expect(getStatusSelect("INC-1042").value).toBe("monitoring");
      expect(
        operationsStore.state.incidents.find((incident) => incident.id === "INC-1042")?.status,
      ).toBe("monitoring");
    } finally {
      if (originalStatus !== undefined) {
        operationsStore.actions.setIncidentStatus("INC-1042", originalStatus);
        await nextTick();
      }
    }
  });

  it("exposes the incident table as a labelled keyboard-focusable region", async () => {
    const PlaceholderPage = () => h("p", null, "placeholder");
    const router = createRouter({
      history: createMemoryHistory("/incidents"),
      routes: [
        { path: "/incidents", name: "incidents", component: IncidentQueuePage },
        {
          path: "/incidents/:id",
          name: "incident-detail",
          component: PlaceholderPage,
        },
      ],
    });
    const container = document.createElement("div");

    createApp(() => h(RouterView))
      .use(router)
      .mount(container);
    await nextTick();

    const region = container.querySelector<HTMLElement>(".table-scroll");
    expect(region?.getAttribute("role")).toBe("region");
    expect(region?.tabIndex).toBe(0);
    expect(region?.getAttribute("aria-label")).toBe("Scrollable incident queue table");
  });

  it("exposes the release table as a labelled keyboard-focusable region", async () => {
    vi.useFakeTimers();
    const container = document.createElement("div");

    try {
      createApp(RecoverableReleasePanel).mount(container);
      await vi.runAllTimersAsync();
      await nextTick();

      const region = container.querySelector<HTMLElement>(".table-scroll");
      expect(region).not.toBeNull();
      expect(region?.getAttribute("role")).toBe("region");
      expect(region?.tabIndex).toBe(0);
      expect(region?.getAttribute("aria-label")).toBe("Scrollable release activity table");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("operations console store", () => {
  it("reports three open incidents", () => {
    const store = createOperationsStore();

    expect(store.getters.openCount).toBe(3);
  });

  it("reports one critical incident", () => {
    const store = createOperationsStore();

    expect(store.getters.criticalCount).toBe(1);
  });

  it("resolves an incident and updates derived counts", () => {
    const store = createOperationsStore();
    const previousIncidents = store.state.incidents;

    expect(store.getters.openCount).toBe(3);
    expect(store.getters.criticalCount).toBe(1);
    expect(store.getters.resolvedCount).toBe(1);

    store.actions.setIncidentStatus("INC-1042", "resolved");

    expect(store.getters.openCount).toBe(2);
    expect(store.getters.criticalCount).toBe(0);
    expect(store.getters.resolvedCount).toBe(2);
    expect(store.state.incidents).not.toBe(previousIncidents);
    expect(store.state.incidents.find((incident) => incident.id === "INC-1042")?.status).toBe(
      "resolved",
    );
  });

  it("creates isolated store state", () => {
    const first = createOperationsStore();
    const second = createOperationsStore();

    expect(first.state.incidents).not.toBe(second.state.incidents);
    expect(first.state.incidents[0]).not.toBe(second.state.incidents[0]);

    first.actions.setIncidentStatus("INC-1042", "resolved");

    expect(second.state.incidents.find((incident) => incident.id === "INC-1042")?.status).toBe(
      "investigating",
    );
  });

  it("rejects an unknown incident", () => {
    const store = createOperationsStore();

    expect(() => store.actions.setIncidentStatus("INC-9999", "resolved")).toThrow(
      /^Unknown incident: INC-9999$/,
    );
  });
});
