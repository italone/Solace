import { generateStaticSiteAsync, renderToStringAsync } from "@italone/solace/server";

import { IncidentSummary } from "../shared/IncidentSummary";

export async function runAsyncRenderingScenario() {
  const rendered = await renderToStringAsync(
    Promise.resolve(<IncidentSummary openCount={3} label="Async operations snapshot" />),
  );
  const site = await generateStaticSiteAsync({
    routes: [
      {
        path: "/async-overview",
        source: Promise.resolve(<IncidentSummary openCount={3} />),
      },
      {
        path: "/async-incident",
        source: Promise.resolve(<IncidentSummary openCount={1} />),
      },
    ],
  });

  return {
    rendered,
    paths: site.pages.map((page) => page.path),
  };
}
