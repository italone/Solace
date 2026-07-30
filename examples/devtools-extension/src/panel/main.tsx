import { reactive, render } from "@italone/solace";

import { TimelinePanel } from "./components";
import { createPanelState, recordDevtoolsEvent, type PanelState } from "./state";
import { createPanelEventSource } from "./transport";
import "./styles.css";

const panelState = reactive(createPanelState());
const eventSource = createPanelEventSource((event) => {
  replacePanelState(recordDevtoolsEvent(panelState, event));
});

function replacePanelState(nextState: PanelState): void {
  const wasPaused = panelState.paused;

  panelState.paused = nextState.paused;
  panelState.limit = nextState.limit;
  panelState.filter = nextState.filter;
  panelState.selectedEventId = nextState.selectedEventId;
  panelState.events = nextState.events;
  panelState.nextEventId = nextState.nextEventId;

  if (wasPaused !== nextState.paused) {
    eventSource.setPaused(nextState.paused);
  }
}

const app = document.querySelector("#app");
if (app !== null) {
  render(<TimelinePanel state={panelState} onStateChange={replacePanelState} />, app);
}
