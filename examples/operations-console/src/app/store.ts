import { createStore } from "@italone/solace";
import type { StoreContext, StoreGetterContext } from "@italone/solace";

import type { Incident, IncidentStatus, ReleaseRecord } from "../domain";
import { createIncidentFixtures, createReleaseFixtures } from "../shared/fixtures";

export interface OperationsState {
  incidents: Incident[];
  releases: ReleaseRecord[];
}

export type OperationsGetters = {
  openCount: number;
  criticalCount: number;
  resolvedCount: number;
};

export function createOperationsStore() {
  return createStore({
    state: (): OperationsState => ({
      incidents: createIncidentFixtures(),
      releases: createReleaseFixtures(),
    }),
    getters: {
      openCount({ state }: StoreGetterContext<OperationsState>) {
        return state.incidents.filter((incident) => incident.status !== "resolved").length;
      },
      criticalCount({ state }: StoreGetterContext<OperationsState>) {
        return state.incidents.filter(
          (incident) => incident.severity === "critical" && incident.status !== "resolved",
        ).length;
      },
      resolvedCount({ state }: StoreGetterContext<OperationsState>) {
        return state.incidents.filter((incident) => incident.status === "resolved").length;
      },
    },
    actions: {
      setIncidentStatus(
        { state }: StoreContext<OperationsState, OperationsGetters>,
        id: string,
        status: IncidentStatus,
      ) {
        const incident = state.incidents.find((item) => item.id === id);

        if (!incident) {
          throw new Error(`Unknown incident: ${id}`);
        }

        state.incidents = state.incidents.map((item) =>
          item.id === id ? { ...item, status } : item,
        );
      },
    },
  });
}

export const operationsStore = createOperationsStore();
