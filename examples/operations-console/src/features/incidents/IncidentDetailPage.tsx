import { RouterLink } from "@italone/solace";
import type { ComponentProps } from "@italone/solace";

import { operationsStore } from "../../app/store";
import { incidentStatusLabels } from "../../domain";

export interface IncidentDetailPageProps extends ComponentProps {
  id?: string;
}

export function IncidentDetailPage(props: IncidentDetailPageProps) {
  return () => {
    const id = typeof props.id === "string" ? props.id : "";
    const incident = operationsStore.state.incidents.find((item) => item.id === id);

    if (!incident) {
      return (
        <section class="page-stack empty-detail" aria-labelledby="missing-incident-heading">
          <p class="section-label">Incident detail</p>
          <h1 id="missing-incident-heading">Incident {id} not found</h1>
          <p>No incident record is available for this identifier.</p>
          <RouterLink class="text-link" to={{ name: "incidents" }}>
            Back to incidents
          </RouterLink>
        </section>
      );
    }

    return (
      <article class="page-stack" aria-labelledby="incident-detail-heading">
        <div class="page-heading page-heading--detail">
          <div>
            <p class="section-label">Incident detail</p>
            <h1 id="incident-detail-heading">
              {incident.id}: {incident.title}
            </h1>
          </div>
          <span class={`status status--${incident.status}`}>
            {incidentStatusLabels[incident.status]}
          </span>
        </div>

        <dl class="detail-grid">
          <div>
            <dt>Owner</dt>
            <dd>{incident.owner}</dd>
          </div>
          <div>
            <dt>Severity</dt>
            <dd>
              <span class={`severity severity--${incident.severity}`}>{incident.severity}</span>
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{incidentStatusLabels[incident.status]}</dd>
          </div>
          <div>
            <dt>Service</dt>
            <dd>{incident.service}</dd>
          </div>
        </dl>

        <section class="content-section" aria-labelledby="incident-summary-heading">
          <p class="section-label">Current assessment</p>
          <h2 id="incident-summary-heading">Summary</h2>
          <p class="detail-summary">{incident.summary}</p>
        </section>

        <RouterLink class="text-link" to={{ name: "incidents" }}>
          Back to incidents
        </RouterLink>
      </article>
    );
  };
}
