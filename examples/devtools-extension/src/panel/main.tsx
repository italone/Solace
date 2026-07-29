import { onDevtoolsEvent } from "@italone/solace/devtools";
import { reactive, render } from "@italone/solace";

import {
  clearTimeline,
  createPanelState,
  filterTimeline,
  getSelectedTimelineRow,
  recordDevtoolsEvent,
  selectTimelineEvent,
  setPanelPaused,
  setRecorderLimit,
  setTimelineFilter,
  type PanelState,
  type TimelineFamily,
} from "./state";

const families: TimelineFamily[] = ["component", "scheduler", "reactivity", "renderer", "store"];
const panelState = reactive(createPanelState());

onDevtoolsEvent((event) => {
  replacePanelState(recordDevtoolsEvent(panelState, event));
});

function replacePanelState(nextState: PanelState): void {
  panelState.paused = nextState.paused;
  panelState.limit = nextState.limit;
  panelState.filter = nextState.filter;
  panelState.selectedEventId = nextState.selectedEventId;
  panelState.events = nextState.events;
  panelState.nextEventId = nextState.nextEventId;
}

function updateLimit(event: Event): void {
  const input = event.target as HTMLInputElement;
  replacePanelState(setRecorderLimit(panelState, input.valueAsNumber));
}

function toggleFamily(family: TimelineFamily): void {
  const nextFamily = panelState.filter.family === family ? undefined : family;
  replacePanelState(setTimelineFilter(panelState, { family: nextFamily }));
}

const Panel = () => {
  const rows = filterTimeline(panelState.events, panelState.filter);
  const selectedRow = getSelectedTimelineRow(panelState);

  return (
    <main class="panel-shell">
      <header class="toolbar">
        <div class="toolbar-group">
          <button
            type="button"
            aria-pressed={panelState.paused}
            onClick={() => replacePanelState(setPanelPaused(panelState, !panelState.paused))}
          >
            {panelState.paused ? "Resume" : "Pause"}
          </button>
          <button type="button" onClick={() => replacePanelState(clearTimeline(panelState))}>
            Clear
          </button>
        </div>
        <label>
          Limit
          <input min="1" step="1" type="number" value={panelState.limit} onChange={updateLimit} />
        </label>
      </header>

      <nav class="filters" aria-label="Timeline filters">
        {families.map((family) => (
          <button
            type="button"
            aria-pressed={panelState.filter.family === family}
            onClick={() => toggleFamily(family)}
          >
            {family}
          </button>
        ))}
      </nav>

      <section class="timeline">
        <ol>
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                aria-pressed={panelState.selectedEventId === row.id}
                onClick={() => replacePanelState(selectTimelineEvent(panelState, row.id))}
              >
                <time>{new Date(row.timestamp).toLocaleTimeString()}</time>
                <strong>{row.event.type}</strong>
                <span>{row.summary}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <aside class="details">
        <pre>{selectedRow === undefined ? "{}" : JSON.stringify(selectedRow.event, null, 2)}</pre>
      </aside>
    </main>
  );
};

const app = document.querySelector("#app");
if (app !== null) {
  render(<Panel />, app);
}
