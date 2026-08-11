import { generateStaticSite, renderToString } from "@italone/solace/server";

import { IncidentSummary } from "../shared/IncidentSummary";

const clientEntry = "src/entries/hydration.tsx";

export function runCoreRenderingScenario() {
  const hydrationBody = renderToString(<IncidentSummary openCount={3} />).html;
  const rendered = renderToString(<IncidentSummary openCount={3} label="Open incidents" />);
  const site = generateStaticSite({
    routes: [
      { path: "/", source: <IncidentSummary openCount={3} /> },
      {
        path: "/incidents/INC-1042",
        source: <IncidentSummary openCount={1} label="Critical incidents" />,
      },
    ],
    manifest: {
      [clientEntry]: {
        file: "assets/hydration.js",
        css: ["assets/operations.css"],
      },
    },
    clientEntry,
    shell: ({ body, styles, assets }) =>
      `<!doctype html><html><head>${styles.join("")}${assets.modulePreloads.join("")}${assets.stylesheets.join("")}</head><body>${body}${assets.scripts.join("")}</body></html>`,
  });

  return { hydrationBody, rendered, site };
}
