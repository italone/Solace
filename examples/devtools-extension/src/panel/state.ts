import type { DevtoolsEvent } from "@italone/solace/devtools";

export type TimelineFamily = "component" | "scheduler" | "reactivity" | "renderer" | "store";

export type PanelView = "timeline" | "components" | "store";

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

export interface StoreActionEntry {
  id: string;
  time: number;
  type: string;
  status: "success" | "error";
  durationMs: number;
}

export interface ComponentTreeNode {
  id: number;
  name: string;
  parentId: number | null;
  mountedEventId: string;
  lastUpdateEventId: string | null;
}

export interface ComponentTreeState {
  nodes: Map<number, ComponentTreeNode>;
  collapsed: Set<number>;
}

export interface PanelState {
  view: PanelView;
  paused: boolean;
  limit: number;
  filter: TimelineFilter;
  selectedEventId: string | null;
  events: TimelineRow[];
  nextEventId: number;
  componentTree: ComponentTreeState;
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
    view: "timeline",
    paused: false,
    limit,
    filter: {},
    selectedEventId: null,
    events: [],
    nextEventId: 1,
    componentTree: { nodes: new Map(), collapsed: new Set() },
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
  const selectedEventId = resolveSelectedEventId(rows, state.filter, state.selectedEventId, {
    preferredEventId: row.id,
  });

  return {
    ...state,
    events: rows,
    selectedEventId,
    nextEventId: state.nextEventId + 1,
    componentTree: applyComponentTreeEvent(state.componentTree, event, row.id),
  };
}

function applyComponentTreeEvent(
  tree: ComponentTreeState,
  event: DevtoolsEvent,
  rowId: string,
): ComponentTreeState {
  if (event.type !== "component:mount" && event.type !== "component:update" && event.type !== "component:unmount") {
    return tree;
  }
  const nodes = new Map(tree.nodes);
  if (event.type === "component:mount") {
    nodes.set(event.id, { id: event.id, name: event.name, parentId: event.parentId, mountedEventId: rowId, lastUpdateEventId: null });
  } else if (event.type === "component:update") {
    const existing = nodes.get(event.id);
    if (existing !== undefined) {
      nodes.set(event.id, { ...existing, lastUpdateEventId: rowId });
    }
  } else {
    removeSubtree(nodes, event.id);
  }
  return { nodes, collapsed: tree.collapsed };
}

function removeSubtree(nodes: Map<number, ComponentTreeNode>, rootId: number): void {
  for (const [id, node] of nodes) {
    if (node.parentId === rootId) {
      removeSubtree(nodes, id);
    }
  }
  nodes.delete(rootId);
}

export function getComponentTreeNodes(state: PanelState): Array<ComponentTreeNode & { depth: number }> {
  const byParent = new Map<number | null, ComponentTreeNode[]>();
  for (const node of state.componentTree.nodes.values()) {
    const siblings = byParent.get(node.parentId) ?? [];
    siblings.push(node);
    byParent.set(node.parentId, siblings);
  }
  const ordered: Array<ComponentTreeNode & { depth: number }> = [];
  const walk = (parentId: number | null, depth: number): void => {
    for (const node of byParent.get(parentId) ?? []) {
      ordered.push({ ...node, depth });
      if (!state.componentTree.collapsed.has(node.id)) {
        walk(node.id, depth + 1);
      }
    }
  };
  walk(null, 0);
  return ordered;
}

export function toggleComponentNode(state: PanelState, nodeId: number): PanelState {
  const collapsed = new Set(state.componentTree.collapsed);
  if (collapsed.has(nodeId)) {
    collapsed.delete(nodeId);
  } else {
    collapsed.add(nodeId);
  }
  return {
    ...state,
    componentTree: { nodes: state.componentTree.nodes, collapsed },
  };
}

export function filterTimeline(rows: TimelineRow[], filter: TimelineFilter): TimelineRow[] {
  if (filter.family === undefined) {
    return rows;
  }

  return rows.filter((row) => row.family === filter.family);
}

export function setPanelView(state: PanelState, view: PanelView): PanelState {
  return {
    ...state,
    view,
  };
}

export function getStoreActionEntries(state: PanelState): StoreActionEntry[] {
  return state.events.flatMap((row) => {
    if (row.event.type !== "store:action") {
      return [];
    }

    return [
      {
        id: row.id,
        time: row.timestamp,
        type: row.event.name,
        status: row.event.status,
        durationMs: row.event.durationMs,
      },
    ];
  });
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
  const selectedEventId = resolveSelectedEventId(events, state.filter, state.selectedEventId);

  return {
    ...state,
    limit,
    events,
    selectedEventId,
  };
}

export function setTimelineFilter(state: PanelState, filter: TimelineFilter): PanelState {
  const selectedEventId = resolveSelectedEventId(state.events, filter, state.selectedEventId);

  return {
    ...state,
    filter,
    selectedEventId,
  };
}

export function selectTimelineEvent(state: PanelState, selectedEventId: string | null): PanelState {
  return {
    ...state,
    selectedEventId: resolveSelectedEventId(state.events, state.filter, state.selectedEventId, {
      explicitEventId: selectedEventId,
    }),
  };
}

export function clearTimeline(state: PanelState): PanelState {
  return {
    ...state,
    events: [],
    selectedEventId: null,
    componentTree: { nodes: new Map(), collapsed: new Set() },
  };
}

export function getSelectedTimelineRow(state: PanelState): TimelineRow | undefined {
  if (state.selectedEventId === null) {
    return undefined;
  }

  return filterTimeline(state.events, state.filter).find((row) => row.id === state.selectedEventId);
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

function resolveSelectedEventId(
  rows: TimelineRow[],
  filter: TimelineFilter,
  selectedEventId: string | null,
  options: { preferredEventId?: string; explicitEventId?: string | null } = {},
): string | null {
  const visibleRows = filterTimeline(rows, filter);

  if (options.explicitEventId === null) {
    return null;
  }

  if (
    options.explicitEventId !== undefined &&
    visibleRows.some((row) => row.id === options.explicitEventId)
  ) {
    return options.explicitEventId;
  }

  if (
    options.preferredEventId !== undefined &&
    visibleRows.some((row) => row.id === options.preferredEventId)
  ) {
    return options.preferredEventId;
  }

  if (selectedEventId !== null && visibleRows.some((row) => row.id === selectedEventId)) {
    return selectedEventId;
  }

  return visibleRows[visibleRows.length - 1]?.id ?? null;
}

function getTimelineSequence(id: string): number {
  return Number(id.slice("timeline-".length));
}

function assertValidLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("DevTools panel recorder limit must be a positive integer");
  }
}
