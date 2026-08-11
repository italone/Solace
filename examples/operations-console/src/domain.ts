export type IncidentStatus = "investigating" | "monitoring" | "resolved";

export type IncidentSeverity = "critical" | "high" | "medium";

export interface Incident {
  id: string;
  title: string;
  service: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  owner: string;
  updatedAt: string;
  summary: string;
}

export interface ReleaseRecord {
  id: string;
  version: string;
  environment: "staging" | "production";
  status: "completed" | "monitoring";
  releasedAt: string;
}

export const incidentStatusLabels: Record<IncidentStatus, string> = {
  investigating: "Investigating",
  monitoring: "Monitoring",
  resolved: "Resolved",
};
