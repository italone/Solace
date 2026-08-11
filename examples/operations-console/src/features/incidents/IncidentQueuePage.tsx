import { RouterLink, computed, ref } from "@italone/solace";

import { operationsStore } from "../../app/store";
import { incidentStatusLabels } from "../../domain";
import type { IncidentStatus } from "../../domain";

export function IncidentQueuePage() {
  const query = ref("");
  const filteredIncidents = computed(() => {
    const normalizedQuery = query.value.trim().toLowerCase();

    if (normalizedQuery.length === 0) {
      return operationsStore.state.incidents;
    }

    return operationsStore.state.incidents.filter((incident) =>
      [incident.id, incident.title, incident.service].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      ),
    );
  });

  return () => (
    <section class="page-stack" aria-labelledby="incident-queue-heading">
      <div class="page-heading">
        <div>
          <p class="section-label">Active response</p>
          <h1 id="incident-queue-heading">Incident queue</h1>
        </div>
        <p class="result-count">{filteredIncidents.value.length} records</p>
      </div>

      <div class="filter-bar">
        <label for="incident-search">Search incidents</label>
        <input
          id="incident-search"
          type="search"
          placeholder="ID, title, or service"
          value={query.value}
          onInput={(event: Event) => {
            query.value = (event.target as HTMLInputElement).value;
          }}
        />
      </div>

      <div
        class="table-scroll"
        role="region"
        tabIndex={0}
        aria-label="Scrollable incident queue table"
      >
        <table>
          <caption>Incident queue</caption>
          <thead>
            <tr>
              <th scope="col">Incident</th>
              <th scope="col">Service</th>
              <th scope="col">Severity</th>
              <th scope="col">Owner</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredIncidents.value.map((incident) => (
              <tr key={incident.id} data-incident-id={incident.id}>
                <th scope="row">
                  <RouterLink
                    class="incident-link"
                    to={{ name: "incident-detail", params: { id: incident.id } }}
                  >
                    {incident.id}
                  </RouterLink>
                  <span class="table-secondary">{incident.title}</span>
                </th>
                <td>{incident.service}</td>
                <td>
                  <span class={`severity severity--${incident.severity}`}>{incident.severity}</span>
                </td>
                <td>{incident.owner}</td>
                <td>
                  <label class="sr-only" for={`status-${incident.id}`}>
                    Status for {incident.id}
                  </label>
                  <select
                    id={`status-${incident.id}`}
                    class={`status-select status-select--${incident.status}`}
                    value={incident.status}
                    onChange={(event: Event) => {
                      operationsStore.actions.setIncidentStatus(
                        incident.id,
                        (event.target as HTMLSelectElement).value as IncidentStatus,
                      );
                    }}
                  >
                    {Object.entries(incidentStatusLabels).map(([value, label]) => (
                      <option key={value} value={value} selected={value === incident.status}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredIncidents.value.length === 0 ? (
        <p class="empty-state">No incidents match the current search.</p>
      ) : null}
    </section>
  );
}
