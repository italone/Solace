import type { DevtoolsEvent } from "@italone/solace/devtools";

export type TimelineFamily = "component" | "scheduler" | "reactivity" | "renderer" | "store";

export interface TimelineFilter {
  family?: TimelineFamily;
}

export interface TimelineRow {
  id: string;
  timestamp: number;
  family: TimelineFamily;
  summary: string;
  event: DevtoolsEvent;
}

export interface PanelState {
  paused: boolean;
  limit: number;
  filter: TimelineFilter;
  selectedEventId: string | null;
  events: TimelineRow[];
  nextEventId: number;
}

export interface RecordDevtoolsEventOptions {
  now?: number;
}

export interface CreatePanelStateOptions {
  limit?: number;
}

const DEFAULT_RECORDER_LIMIT = 500;

export function createPanelState(options: CreatePanelStateOptions = {}): PanelState {
  const limit = options.limit ?? DEFAULT_RECORDER_LIMIT;
  assertValidLimit(limit);

  return {
    paused: false,
    limit,
    filter: {},
    selectedEventId: null,
    events: [],
    nextEventId: 1,
  };
}

export function recordDevtoolsEvent(
  state: PanelState,
  event: DevtoolsEvent,
  options: RecordDevtoolsEventOptions = {},
): PanelState {
  if (state.paused) {
    return state;
  }

  const row: TimelineRow = {
    id: `timeline-${state.nextEventId}`,
    timestamp: options.now ?? Date.now(),
    family: getTimelineFamily(event),
    summary: summarizeDevtoolsEvent(event),
    event,
  };
  const rows = trimTimelineRows([...state.events, row].sort(compareTimelineRows), state.limit);
  const selectedEventId =
    rows.some((candidate) => candidate.id === row.id) || rows.length === 0
      ? row.id
      : rows[rows.length - 1].id;

  return {
    ...state,
    events: rows,
    selectedEventId,
    nextEventId: state.nextEventId + 1,
  };
}

export function filterTimeline(rows: TimelineRow[], filter: TimelineFilter): TimelineRow[] {
  if (filter.family === undefined) {
    return rows;
  }

  return rows.filter((row) => row.family === filter.family);
}

export function setPanelPaused(state: PanelState, paused: boolean): PanelState {
  return {
    ...state,
    paused,
  };
}

export function setRecorderLimit(state: PanelState, limit: number): PanelState {
  assertValidLimit(limit);
  const events = trimTimelineRows(state.events, limit);
  const selectedEventId =
    state.selectedEventId !== null && events.some((row) => row.id === state.selectedEventId)
      ? state.selectedEventId
      : events.length > 0
        ? events[events.length - 1].id
        : null;

  return {
    ...state,
    limit,
    events,
    selectedEventId,
  };
}

export function setTimelineFilter(state: PanelState, filter: TimelineFilter): PanelState {
  const visibleRows = filterTimeline(state.events, filter);
  const selectedEventId =
    state.selectedEventId !== null && visibleRows.some((row) => row.id === state.selectedEventId)
      ? state.selectedEventId
      : (visibleRows[visibleRows.length - 1]?.id ?? null);

  return {
    ...state,
    filter,
    selectedEventId,
  };
}

export function selectTimelineEvent(state: PanelState, selectedEventId: string | null): PanelState {
  return {
    ...state,
    selectedEventId,
  };
}

export function clearTimeline(state: PanelState): PanelState {
  return {
    ...state,
    events: [],
    selectedEventId: null,
  };
}

export function getSelectedTimelineRow(state: PanelState): TimelineRow | undefined {
  if (state.selectedEventId === null) {
    return undefined;
  }

  return state.events.find((row) => row.id === state.selectedEventId);
}

function getTimelineFamily(event: DevtoolsEvent): TimelineFamily {
  return event.type.slice(0, event.type.indexOf(":")) as TimelineFamily;
}

function summarizeDevtoolsEvent(event: DevtoolsEvent): string {
  switch (event.type) {
    case "component:mount":
      return `${event.name} #${event.id} mounted`;
    case "component:update":
      return `${event.name} #${event.id} updated`;
    case "component:unmount":
      return `${event.name} #${event.id} unmounted`;
    case "component:emit":
      return `${event.name} #${event.id} emitted ${event.event} to ${event.handlerCount} handlers`;
    case "scheduler:flush":
      return `${event.queuedJobs} jobs flushed, ${event.dedupedJobs} deduped in ${event.durationMs}ms`;
    case "reactivity:trigger":
      return `${event.targetType} ${event.keyType} triggered ${event.effectCount} effects`;
    case "renderer:element":
      return `${event.operation} <${event.tag}>`;
    case "store:action":
      return `${event.name} ${event.status} in ${event.durationMs}ms`;
  }
}

function compareTimelineRows(left: TimelineRow, right: TimelineRow): number {
  if (left.timestamp !== right.timestamp) {
    return left.timestamp - right.timestamp;
  }

  return getTimelineSequence(left.id) - getTimelineSequence(right.id);
}

function trimTimelineRows(rows: TimelineRow[], limit: number): TimelineRow[] {
  if (rows.length <= limit) {
    return rows;
  }

  return rows.slice(rows.length - limit);
}

function getTimelineSequence(id: string): number {
  return Number(id.slice("timeline-".length));
}

function assertValidLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("DevTools panel recorder limit must be a positive integer");
  }
}
