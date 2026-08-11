import type { Incident, ReleaseRecord } from "../domain";

export function createIncidentFixtures(): Incident[] {
  return [
    {
      id: "INC-1042",
      title: "Checkout latency spike",
      service: "Checkout API",
      severity: "critical",
      status: "investigating",
      owner: "Maya Chen",
      updatedAt: "2026-08-11T04:42:00Z",
      summary: "Checkout requests are exceeding the latency objective in production.",
    },
    {
      id: "INC-1039",
      title: "Delayed webhook delivery",
      service: "Webhook Dispatcher",
      severity: "high",
      status: "monitoring",
      owner: "Noah Williams",
      updatedAt: "2026-08-11T03:18:00Z",
      summary: "Webhook delivery has recovered and the backlog is being monitored.",
    },
    {
      id: "INC-1037",
      title: "Elevated authentication errors",
      service: "Identity Gateway",
      severity: "medium",
      status: "investigating",
      owner: "Ava Patel",
      updatedAt: "2026-08-11T02:51:00Z",
      summary: "A subset of sign-in attempts is returning unexpected authorization errors.",
    },
    {
      id: "INC-1031",
      title: "Search index lag",
      service: "Search Pipeline",
      severity: "medium",
      status: "resolved",
      owner: "Ethan Brooks",
      updatedAt: "2026-08-10T22:06:00Z",
      summary: "Search indexing delay returned to normal after worker capacity was restored.",
    },
  ];
}

export function createReleaseFixtures(): ReleaseRecord[] {
  return [
    {
      id: "REL-208",
      version: "2.18.0",
      environment: "production",
      status: "monitoring",
      releasedAt: "2026-08-11T03:30:00Z",
    },
    {
      id: "REL-207",
      version: "2.18.0-rc.2",
      environment: "staging",
      status: "completed",
      releasedAt: "2026-08-10T18:20:00Z",
    },
    {
      id: "REL-206",
      version: "2.17.4",
      environment: "production",
      status: "completed",
      releasedAt: "2026-08-09T09:15:00Z",
    },
  ];
}
