import { RouterLink } from "@italone/solace";

import { operationsStore } from "../../app/store";
import { incidentStatusLabels } from "../../domain";

export function OverviewPage() {
  return () => {
    const recentIncidents = operationsStore.state.incidents.slice(0, 3);

    return (
      <section class="page-stack" aria-labelledby="overview-heading">
        <div class="page-heading">
          <div>
            <p class="section-label">Current posture</p>
            <h1 id="overview-heading">Operations overview</h1>
          </div>
          <p class="last-updated">Updated 12:42 UTC</p>
        </div>

        <dl class="metric-grid" aria-label="Incident metrics">
          <div class="metric metric--attention">
            <dt>Open incidents</dt>
            <dd>{operationsStore.getters.openCount}</dd>
          </div>
          <div class="metric metric--critical">
            <dt>Critical incidents</dt>
            <dd>{operationsStore.getters.criticalCount}</dd>
          </div>
          <div class="metric metric--stable">
            <dt>Resolved</dt>
            <dd>{operationsStore.getters.resolvedCount}</dd>
          </div>
        </dl>

        <section class="content-section" aria-labelledby="recent-incidents-heading">
          <div class="section-heading">
            <div>
              <p class="section-label">Triage queue</p>
              <h2 id="recent-incidents-heading">Recent incidents</h2>
            </div>
            <RouterLink class="text-link" to={{ name: "incidents" }}>
              View incident queue
            </RouterLink>
          </div>

          <ul class="incident-list">
            {recentIncidents.map((incident) => (
              <li key={incident.id}>
                <div class="incident-list__identity">
                  <RouterLink
                    class="incident-link"
                    to={{ name: "incident-detail", params: { id: incident.id } }}
                  >
                    {incident.id}: {incident.title}
                  </RouterLink>
                  <span class="muted-text">{incident.service}</span>
                </div>
                <span class={`status status--${incident.status}`}>
                  {incidentStatusLabels[incident.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </section>
    );
  };
}
